param(
  [ValidateSet('Inspect','BackupAndVerify','VerifyExisting','CheckSchema','CheckPostMigration','CheckOwnership','RehearseExisting')][string]$Mode='Inspect',
  [switch]$ExecuteApprovedBackup,
  [switch]$ExecuteApprovedRehearsal,
  [string]$ArchiveRunId
)

# Owner-approved, specific OS PLUS project only. Never put plaintext access in
# arguments, environment, files, stdout or errors. Child gets a private stdin pipe.
$ErrorActionPreference='Stop'
$backupProcess=$null
$backupSecurePassword=$null
$backupBstr=[IntPtr]::Zero
$backupStep='platform'
try{
  if(-not $IsWindows){throw 'WINDOWS_REQUIRED'}
  if($Mode -in @('BackupAndVerify','VerifyExisting') -and -not $ExecuteApprovedBackup){throw 'EXPLICIT_BACKUP_SWITCH_REQUIRED'}
  if($Mode -eq 'RehearseExisting' -and (-not $ExecuteApprovedRehearsal -or $ArchiveRunId -cne '1b2bc4faa9b34c0b8af1e5eb1e9dba5b')){throw 'EXPLICIT_REHEARSAL_SCOPE_REQUIRED'}
  $backupStep='private_path'
  $backupLocalRoot=[IO.Path]::GetFullPath([Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)).TrimEnd('\')
  if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA) -or
    -not $backupLocalRoot.Equals([IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\'),[StringComparison]::OrdinalIgnoreCase)){
    throw 'LOCAL_ROOT_OVERRIDE_REJECTED'
  }
  $backupPrivateRoot=Join-Path $backupLocalRoot 'OSPlusPrivateBackups'
  $backupAccessPath=Join-Path $backupPrivateRoot 'backup-access.dpapi.json'
  $backupCaPath=Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads\prod-ca-2021.crt'
  $backupOwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
  $backupAncestor=[IO.DirectoryInfo]::new($backupPrivateRoot)
  while($null -ne $backupAncestor){
    $backupAncestorItem=Get-Item -Force -LiteralPath $backupAncestor.FullName
    if(($backupAncestorItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
      (Test-Path -LiteralPath (Join-Path $backupAncestor.FullName '.git')) -or
      $backupAncestor.FullName -match '(^|[\\/])OneDrive[^\\/]*([\\/]|$)'){
      throw 'PRIVATE_PATH_REDIRECTED_OR_SYNCED'
    }
    $backupAncestor=$backupAncestor.Parent
  }
  foreach($backupSyncRoot in @($env:OneDrive,$env:OneDriveConsumer,$env:OneDriveCommercial)){
    if(-not [string]::IsNullOrWhiteSpace($backupSyncRoot)){
      $backupSyncPath=[IO.Path]::GetFullPath($backupSyncRoot).TrimEnd('\')
      if($backupPrivateRoot.Equals($backupSyncPath,[StringComparison]::OrdinalIgnoreCase) -or
        $backupPrivateRoot.StartsWith($backupSyncPath+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'SYNCED_DESTINATION_REJECTED'}
    }
  }
  $backupStep='private_permissions'
  $backupCheckPaths=@($backupPrivateRoot,$backupAccessPath)
  if($Mode -in @('VerifyExisting','RehearseExisting')){
    if($ArchiveRunId -cnotmatch '^[a-f0-9]{32}$'){throw 'ARCHIVE_RUN_ID_INVALID'}
    $backupExistingFolder=Join-Path $backupPrivateRoot ('backup-'+$ArchiveRunId)
    $backupExistingKey=Join-Path $backupExistingFolder 'archive-key.dpapi.json'
    $backupCheckPaths=@($backupPrivateRoot,$backupExistingFolder,$backupExistingKey,
      (Join-Path $backupExistingFolder 'application.pgcustom.aesgcm'),(Join-Path $backupExistingFolder 'catalogue.json.aesgcm'))
  }
  foreach($backupPath in $backupCheckPaths){
    $backupItem=Get-Item -Force -LiteralPath $backupPath
    if(($backupItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'PRIVATE_LINK_REJECTED'}
    $backupAcl=Get-Acl -LiteralPath $backupPath
    if($backupAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $backupOwnerSid.Value){throw 'PRIVATE_OWNER_INVALID'}
    if($backupPath -eq $backupPrivateRoot -and -not $backupAcl.AreAccessRulesProtected){throw 'PRIVATE_ACL_UNPROTECTED'}
    foreach($backupRule in $backupAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
      if($backupRule.AccessControlType -ne 'Allow' -or $backupRule.IdentityReference.Value -notin @($backupOwnerSid.Value,'S-1-5-18')){
        throw 'PRIVATE_ACL_TOO_BROAD'
      }
      if($backupPath -eq $backupPrivateRoot -and
        ($backupRule.InheritanceFlags -band [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit') -ne
        [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'){throw 'PRIVATE_CHILD_INHERITANCE_INVALID'}
    }
  }
  if($Mode -in @('VerifyExisting','RehearseExisting')){
    $backupStep='offline_key_binding'
    if((Get-Item -LiteralPath $backupExistingKey).Length -gt 16384){throw 'ACCESS_FILE_TOO_LARGE'}
    $backupKeyRecord=[IO.File]::ReadAllText($backupExistingKey)|ConvertFrom-Json
    if($backupKeyRecord.version -ne 1 -or $backupKeyRecord.runId -cne $ArchiveRunId -or
      $backupKeyRecord.projectRef -cne 'dxiyihrdfismbuqdmhit' -or $backupKeyRecord.ownerSid -cne $backupOwnerSid.Value){throw 'ACCESS_PROJECT_BINDING_INVALID'}
    $backupSecurePassword=ConvertTo-SecureString -String $backupKeyRecord.keyDpapi
    $backupBstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($backupSecurePassword)
    $backupKeyString=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($backupBstr)
    if([Convert]::FromBase64String($backupKeyString).Length -ne 32){throw 'KEY_DPAPI_ROUNDTRIP_FAILED'}
    $backupPayload=[ordered]@{mode=$Mode;approved=$(if($Mode -eq 'RehearseExisting'){[bool]$ExecuteApprovedRehearsal}else{[bool]$ExecuteApprovedBackup});projectRef='dxiyihrdfismbuqdmhit';
      localRoot=$backupLocalRoot;privateRoot=$backupPrivateRoot;ownerSid=$backupOwnerSid.Value;nonce=$ArchiveRunId;key=$backupKeyString}
    if($Mode -eq 'RehearseExisting'){$backupPayload.rehearsalApproved=$true}
  }else{
  if((Get-Item -LiteralPath $backupAccessPath).Length -gt 16384){throw 'ACCESS_FILE_TOO_LARGE'}
  $backupCaItem=Get-Item -Force -LiteralPath $backupCaPath
  if($backupCaItem.PSIsContainer -or $backupCaItem.Length -gt 16384 -or
    ($backupCaItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'PUBLIC_CA_FILE_INVALID'}
  $backupStep='access_binding'
  $backupAccess=Get-Content -Raw -LiteralPath $backupAccessPath | ConvertFrom-Json
  if($backupAccess.version -ne 1 -or $backupAccess.purpose -cne 'read-only OS PLUS application backup' -or
    $backupAccess.host -cne 'db.dxiyihrdfismbuqdmhit.supabase.co' -or $backupAccess.port -ne 5432 -or
    $backupAccess.database -cne 'postgres' -or $backupAccess.user -cne 'postgres' -or
    $backupAccess.ownerSid -cne $backupOwnerSid.Value){throw 'ACCESS_PROJECT_BINDING_INVALID'}
  # DPAPI decrypts only as this owner; do not rewrite the original access file.
  $backupStep='dpapi_decryption'
  $backupSecurePassword=ConvertTo-SecureString -String $backupAccess.passwordDpapi
  $backupBstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($backupSecurePassword)
  $backupPlainPassword=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($backupBstr)
  $backupPayload=[ordered]@{mode=$(if($Mode -in @('CheckSchema','CheckPostMigration','CheckOwnership')){'Inspect'}else{$Mode});approved=[bool]$ExecuteApprovedBackup;projectRef='dxiyihrdfismbuqdmhit';
    host='aws-1-ap-northeast-2.pooler.supabase.com';port=5432;database='postgres';user='postgres.dxiyihrdfismbuqdmhit';
    password=$backupPlainPassword;ca=[IO.File]::ReadAllText($backupCaPath);localRoot=$backupLocalRoot;
    privateRoot=$backupPrivateRoot;ownerSid=$backupOwnerSid.Value}
  if($Mode -eq 'BackupAndVerify'){
    $backupKey=[Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
    $backupKeyString=[Convert]::ToBase64String($backupKey)
    $backupSecureKey=ConvertTo-SecureString -String $backupKeyString -AsPlainText -Force
    try{$backupProtectedKey=ConvertFrom-SecureString -SecureString $backupSecureKey}finally{$backupSecureKey.Dispose()}
    $backupRecoveredKey=ConvertTo-SecureString -String $backupProtectedKey
    $backupKeyBstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($backupRecoveredKey)
    try{
      if([Runtime.InteropServices.Marshal]::PtrToStringBSTR($backupKeyBstr) -cne $backupKeyString){throw 'KEY_DPAPI_ROUNDTRIP_FAILED'}
    }finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($backupKeyBstr);$backupRecoveredKey.Dispose()}
    $backupPayload.nonce=[Guid]::NewGuid().ToString('N')
    $backupPayload.key=$backupKeyString
    $backupPayload.protectedKey=$backupProtectedKey
  }
  }
  $backupStep='runner_launch'
  $backupNode=(Get-Command node -CommandType Application | Select-Object -First 1).Source
  $backupRunner=Join-Path $PSScriptRoot 'shopify-db-harness\private-backup.mjs'
  if($Mode -in @('CheckSchema','CheckPostMigration')){$backupRunner=Join-Path $PSScriptRoot 'shopify-db-harness\schema-compatibility.mjs'}
  if($Mode -eq 'CheckOwnership'){$backupRunner=Join-Path $PSScriptRoot 'shopify-db-harness\ownership-check.mjs'}
  $backupStart=[Diagnostics.ProcessStartInfo]::new()
  $backupStart.FileName=$backupNode
  $backupStart.ArgumentList.Add($backupRunner)
  if($Mode -eq 'CheckPostMigration'){$backupStart.ArgumentList.Add('--post-migration')}
  $backupStart.WorkingDirectory=$PSScriptRoot
  $backupStart.UseShellExecute=$false
  $backupStart.CreateNoWindow=$true
  $backupStart.RedirectStandardInput=$true
  $backupStart.RedirectStandardOutput=$true
  $backupStart.RedirectStandardError=$true
  $backupProcess=[Diagnostics.Process]::new()
  $backupProcess.StartInfo=$backupStart
  $null=$backupProcess.Start()
  $backupOutputTask=$backupProcess.StandardOutput.ReadToEndAsync()
  $backupErrorTask=$backupProcess.StandardError.ReadToEndAsync()
  $backupProcess.StandardInput.Write(($backupPayload | ConvertTo-Json -Compress))
  $backupProcess.StandardInput.Close()
  $backupPlainPassword=$null
  $backupPayload=$null
  $backupRunnerDeadline=if($Mode -eq 'RehearseExisting'){660000}else{360000}
  if(-not $backupProcess.WaitForExit($backupRunnerDeadline)){
    $backupProcess.Kill($true)
    throw 'RUNNER_DEADLINE_EXCEEDED'
  }
  # Only the runner's small structured report is emitted, never raw stderr.
  $backupStep='runner_report'
  $backupOutput=$backupOutputTask.GetAwaiter().GetResult()
  $backupReportLimit=if($Mode -in @('CheckSchema','CheckPostMigration','RehearseExisting')){262144}else{16384}
  if($backupOutput.Length -gt $backupReportLimit){throw 'RUNNER_REPORT_TOO_LARGE'}
  $backupReport=$backupOutput | ConvertFrom-Json
  if($backupReport.kind -cne 'osplus-private-backup-report-v1'){throw 'RUNNER_REPORT_INVALID'}
  $backupReport | ConvertTo-Json -Depth 12
  if($backupProcess.ExitCode -ne 0){exit 1}
}catch{
  # Do not print exception text: it could contain private input or SQL details.
  $backupKnownCodes=@('WINDOWS_REQUIRED','EXPLICIT_BACKUP_SWITCH_REQUIRED','LOCAL_ROOT_OVERRIDE_REJECTED','PRIVATE_PATH_REDIRECTED_OR_SYNCED',
    'SYNCED_DESTINATION_REJECTED','PRIVATE_LINK_REJECTED','PRIVATE_OWNER_INVALID','PRIVATE_ACL_UNPROTECTED','PRIVATE_ACL_TOO_BROAD',
    'PRIVATE_CHILD_INHERITANCE_INVALID','ACCESS_FILE_TOO_LARGE','PUBLIC_CA_FILE_INVALID','ACCESS_PROJECT_BINDING_INVALID',
    'KEY_DPAPI_ROUNDTRIP_FAILED','RUNNER_DEADLINE_EXCEEDED','RUNNER_REPORT_TOO_LARGE','RUNNER_REPORT_INVALID','ARCHIVE_RUN_ID_INVALID','EXPLICIT_REHEARSAL_SCOPE_REQUIRED')
  $backupSafeCode=if($_.Exception.Message -cin $backupKnownCodes){$_.Exception.Message}else{'PRIVATE_ACCESS_OR_RUNNER_CHECK_FAILED'}
  [pscustomobject]@{kind='osplus-private-backup-report-v1';status='failed';step=$backupStep;code=$backupSafeCode;
    exceptionType=$_.Exception.GetType().Name;errorNumber=$_.Exception.HResult;
    innerType=$(if($null -ne $_.Exception.InnerException){$_.Exception.InnerException.GetType().Name}else{'none'});
    scriptLine=$_.InvocationInfo.ScriptLineNumber} | ConvertTo-Json -Compress
  exit 1
}finally{
  if($backupBstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($backupBstr)}
  if($null -ne $backupSecurePassword){$backupSecurePassword.Dispose()}
  if($null -ne $backupKey){[Array]::Clear($backupKey,0,$backupKey.Length)}
  $backupPlainPassword=$null;$backupKeyString=$null;$backupAccess=$null;$backupPayload=$null
  if($null -ne $backupProcess){$backupProcess.Dispose()}
}
