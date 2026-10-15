param([Parameter(Mandatory=$true)][string]$KeyFile)
# Internal verifier. Emits only a SHA-256 of a random archive key, never the key.
$ErrorActionPreference='Stop';$keySecure=$null;$keyPointer=[IntPtr]::Zero;$keyBytes=$null
try{
  if(-not $IsWindows){throw 'WINDOWS_REQUIRED'}
  $keyRoot=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'OSPlusPrivateBackups'
  $keyResolved=[IO.Path]::GetFullPath($KeyFile)
  if(-not $keyResolved.StartsWith($keyRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or
    $keyResolved.Substring($keyRoot.Length) -notmatch '^\\backup-[a-f0-9]{32}\\archive-key\.dpapi\.json$'){throw 'KEY_PATH_INVALID'}
  $keyCurrent=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  foreach($keyPath in @($keyResolved,(Split-Path -Parent $keyResolved),$keyRoot)){
    $keyItem=Get-Item -Force -LiteralPath $keyPath
    if(($keyItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'KEY_LINK_INVALID'}
    $keyAcl=Get-Acl -LiteralPath $keyPath
    if($keyAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $keyCurrent){throw 'KEY_OWNER_INVALID'}
    foreach($keyRule in $keyAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
      if($keyRule.AccessControlType -ne 'Allow' -or $keyRule.IdentityReference.Value -notin @($keyCurrent,'S-1-5-18')){throw 'KEY_ACL_INVALID'}
    }
  }
  if((Get-Item -LiteralPath $keyResolved).Length -gt 16384){throw 'KEY_FILE_TOO_LARGE'}
  $keyRecord=[IO.File]::ReadAllText($keyResolved)|ConvertFrom-Json
  if($keyRecord.version -ne 1 -or $keyRecord.ownerSid -cne $keyCurrent -or $keyRecord.projectRef -cne 'dxiyihrdfismbuqdmhit' -or
    (Split-Path -Leaf (Split-Path -Parent $keyResolved)) -cne ('backup-'+$keyRecord.runId)){throw 'KEY_BINDING_INVALID'}
  $keySecure=ConvertTo-SecureString -String $keyRecord.keyDpapi
  $keyPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($keySecure)
  $keyBytes=[Convert]::FromBase64String([Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer))
  if($keyBytes.Length -ne 32){throw 'KEY_LENGTH_INVALID'}
  [pscustomobject]@{verified=$true;sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($keyBytes)).ToLowerInvariant()}|ConvertTo-Json -Compress
}catch{Write-Output '{"verified":false}';exit 1}
finally{
  if($keyPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)}
  if($null -ne $keySecure){$keySecure.Dispose()}
  if($null -ne $keyBytes){[Array]::Clear($keyBytes,0,$keyBytes.Length)}
}
