param(
  [string]$RepoName = 'lift-ledger',
  [switch]$Private
)

$ErrorActionPreference = 'Stop'
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

$Gh = 'C:\Users\benji\Tools\gh\bin\gh.exe'
$Git = 'C:\Program Files\Git\cmd\git.exe'

if (-not (Test-Path -LiteralPath $Gh)) { throw 'GitHub CLI not found. Expected C:\Users\benji\Tools\gh\bin\gh.exe' }
if (-not (Test-Path -LiteralPath $Git)) { throw 'Git not found. Expected C:\Program Files\Git\cmd\git.exe' }

& $Gh auth status

if (-not (Test-Path -LiteralPath '.git')) {
  & $Git init
  & $Git branch -M main
}

& $Git add index.html styles.css app.js program-data.js manifest.webmanifest service-worker.js icon.svg README.md HOW_TO_USE.md publish-github-pages.ps1
& $Git commit -m 'Create Lift Ledger workout tracker' 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host 'No new local changes to commit, continuing.' }

$visibility = if ($Private) { '--private' } else { '--public' }
$hasRemote = (& $Git remote) -contains 'origin'
if (-not $hasRemote) {
  & $Gh repo create $RepoName $visibility --source . --remote origin --push
} else {
  & $Git push -u origin main
}

& $Gh api -X POST "repos/:owner/$RepoName/pages" -f source.branch='main' -f source.path='/' 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Pages may already be enabled. Continuing.'
}

$owner = (& $Gh api user --jq '.login').Trim()
$url = "https://$owner.github.io/$RepoName/"
Write-Host ''
Write-Host 'Your iPhone URL:'
Write-Host $url
Write-Host ''
Write-Host 'Open it in Safari, Share, Add to Home Screen.'
