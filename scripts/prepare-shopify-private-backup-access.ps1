param(
  [Parameter(Mandatory=$true)][string]$DatabaseHost,
  [int]$DatabasePort=5432,
  [string]$DatabaseName='postgres',
  [string]$DatabaseUser='postgres',
  [switch]$ValidateOnly
)

# Credential preparation only. No network, pg_dump, restore, SQL or migration.
# Run interactively as the same Windows user who will perform the backup.
$ErrorActionPreference='Stop'
if(-not $IsWindows){throw 'Windows protection is required for this setup.'}
if($DatabaseHost -cnotmatch '^db\.[a-z0-9]{20}\.supabase\.co$' -or
   $DatabasePort -ne 5432 -or $DatabaseName -cne 'postgres' -or $DatabaseUser -cne 'postgres'){
  throw 'Use the reviewed Supabase direct database host and postgres settings.'
}
$backupKnownFolder=[Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
if([string]::IsNullOrWhiteSpace($backupKnownFolder) -or [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){
  throw 'Windows local application folder is unavailable.'
}
$backupLocalRoot=[IO.Path]::GetFullPath($backupKnownFolder).TrimEnd([IO.Path]::DirectorySeparatorChar)
$backupEnvironmentRoot=[IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd([IO.Path]::DirectorySeparatorChar)
if(-not $backupLocalRoot.Equals($backupEnvironmentRoot,[StringComparison]::OrdinalIgnoreCase) -or
   -not [IO.Directory]::Exists($backupLocalRoot)){
  throw 'Local application folder override is not trusted. No password will be requested.'
}
if($backupLocalRoot -match '(^|[\\/])OneDrive[^\\/]*([\\/]|$)'){
  throw 'Private access files must not be stored in OneDrive.'
}
foreach($backupSyncRoot in @($env:OneDrive,$env:OneDriveConsumer,$env:OneDriveCommercial)){
  if(-not [string]::IsNullOrWhiteSpace($backupSyncRoot)){
    $backupSyncPath=[IO.Path]::GetFullPath($backupSyncRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
    if($backupLocalRoot.Equals($backupSyncPath,[StringComparison]::OrdinalIgnoreCase) -or
      $backupLocalRoot.StartsWith($backupSyncPath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){
      throw 'Private access files must not be inside a synced folder.'
    }
  }
}
# Existing ancestors must be genuine local directories, not a redirected tree or
# a repository. Check these BEFORE directory creation and the password prompt.
$backupAncestor=[IO.DirectoryInfo]::new($backupLocalRoot)
while($null -ne $backupAncestor){
  $backupAncestorItem=Get-Item -Force -LiteralPath $backupAncestor.FullName
  if(($backupAncestorItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
     (Test-Path -LiteralPath (Join-Path $backupAncestor.FullName '.git'))){
    throw 'Private access destination has a redirected or repository ancestor.'
  }
  $backupAncestor=$backupAncestor.Parent
}
$backupPrivateDirectory=Join-Path $backupLocalRoot 'OSPlusPrivateBackups'
$backupCredentialFile=Join-Path $backupPrivateDirectory 'backup-access.dpapi.json'
if(-not $backupPrivateDirectory.StartsWith($backupLocalRoot+[IO.Path]::DirectorySeparatorChar)){
  throw 'Private destination is outside the expected local application directory.'
}
foreach($backupExistingPath in @($backupLocalRoot,$backupPrivateDirectory,$backupCredentialFile)){
  if(Test-Path -LiteralPath $backupExistingPath){
    $backupItem=Get-Item -Force -LiteralPath $backupExistingPath
    if(($backupItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
      throw 'Private destination must not be a link or a cloud-synced placeholder.'
    }
  }
}
if(Test-Path -LiteralPath $backupCredentialFile){throw 'An access file already exists. It will not be overwritten.'}
if($ValidateOnly){
  [pscustomobject]@{mode='validation only';host=$DatabaseHost;port=$DatabasePort;database=$DatabaseName;
    user=$DatabaseUser;networkRequests=0;filesWritten=0;passwordRequested=$false} | ConvertTo-Json
  exit 0
}

$backupUserSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$backupSystemSid=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
# Isolate only this purpose-specific directory, never modify AppData/root ACLs.
if(-not(Test-Path -LiteralPath $backupPrivateDirectory)){
  New-Item -ItemType Directory -Path $backupPrivateDirectory | Out-Null
}elseif(-not(Get-Item -LiteralPath $backupPrivateDirectory).PSIsContainer){throw 'Private directory is not a folder.'}
if(@(Get-ChildItem -Force -LiteralPath $backupPrivateDirectory).Count -gt 0){
  throw 'Private directory is not empty. Existing files and permissions will not be changed.'
}
$backupDirectoryAcl=[Security.AccessControl.DirectorySecurity]::new()
$backupDirectoryAcl.SetOwner($backupUserSid)
$backupDirectoryAcl.SetAccessRuleProtection($true,$false)
foreach($backupSid in @($backupUserSid,$backupSystemSid)){
  $backupDirectoryAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($backupSid,
    [Security.AccessControl.FileSystemRights]::FullControl,
    [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',
    [Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))
}
Set-Acl -LiteralPath $backupPrivateDirectory -AclObject $backupDirectoryAcl
$backupVerifiedAcl=Get-Acl -LiteralPath $backupPrivateDirectory
if(-not $backupVerifiedAcl.AreAccessRulesProtected -or
   $backupVerifiedAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $backupUserSid.Value){
  throw 'Private directory protection could not be verified.'
}
foreach($backupRule in $backupVerifiedAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
  if($backupRule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
    $backupRule.IdentityReference.Value -notin @($backupUserSid.Value,$backupSystemSid.Value)){
    throw 'Unexpected private directory permissions; no password will be requested.'
  }
}

$backupPassword=Read-Host -Prompt 'Enter the EXISTING OS PLUS database password (hidden; do not paste it into chat)' -AsSecureString
try{
  if($backupPassword.Length -eq 0){throw 'No password entered. No access file was saved.'}
  $backupProtectedPassword=ConvertFrom-SecureString -SecureString $backupPassword
  $backupRecord=[ordered]@{version=1;purpose='read-only OS PLUS application backup';host=$DatabaseHost;
    port=$DatabasePort;database=$DatabaseName;user=$DatabaseUser;ownerSid=$backupUserSid.Value;
    createdAt=[DateTimeOffset]::UtcNow.ToString('o');passwordDpapi=$backupProtectedPassword}
  # CreateNew prevents overwriting any concurrent/previous private access file.
  $backupFileStream=[IO.File]::Open($backupCredentialFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{
    $backupBytes=[Text.UTF8Encoding]::new($false).GetBytes(($backupRecord | ConvertTo-Json))
    $backupFileStream.Write($backupBytes,0,$backupBytes.Length)
    $backupFileStream.Flush($true)
  }finally{$backupFileStream.Dispose()}
  Write-Host 'Protected access file saved. This has NOT connected, created a backup, restored data or run migrations.'
  Write-Host ('Private file: '+$backupCredentialFile)
}finally{
  $backupPassword.Dispose()
  $backupProtectedPassword=$null
  $backupRecord=$null
}
