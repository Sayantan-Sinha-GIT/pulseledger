param([string]$Project = (Get-Location).Path)

$ErrorActionPreference = 'Stop'
$ledger = Join-Path $Project 'QUALITY_CASES.md'
if (-not (Test-Path -LiteralPath $ledger)) { throw "Missing $ledger" }
$lines = Get-Content -LiteralPath $ledger
$rows = @()
$errors = [System.Collections.Generic.List[string]]::new()
$lineNumber = 0
foreach ($line in $lines) {
  $lineNumber++
  if ($line -notmatch '^\s*\|') { continue }
  $cells = @($line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() })
  if ($cells[0] -in @('ID','---') -or $cells[0] -match '^:?-+:?$') { continue }
  if ($cells.Count -ne 10) { $errors.Add("Line ${lineNumber}: expected 10 cells, found $($cells.Count)."); continue }
  $rows += [pscustomobject]@{
    ID=$cells[0]; Requirement=$cells[1]; Risk=$cells[2].ToLowerInvariant()
    Iteration=$cells[3]; Scenario=$cells[4]; Expected=$cells[5]
    Method=$cells[6]; Actual=$cells[7]; Status=$cells[8].ToLowerInvariant()
    Evidence=$cells[9]
  }
}

if ($rows.Count -eq 0) { $errors.Add('No test cases found in the ten-column Markdown table.') }
$seenIDs = @{}
$seenScenarios = @{}
foreach ($row in $rows) {
  foreach ($field in @('ID','Requirement','Risk','Iteration','Scenario','Expected','Method','Actual','Status','Evidence')) {
    if ([string]::IsNullOrWhiteSpace($row.$field) -or $row.$field -eq '-') { $errors.Add("$($row.ID): $field is empty.") }
  }
  if ($seenIDs.ContainsKey($row.ID)) { $errors.Add("Duplicate case ID: $($row.ID)") } else { $seenIDs[$row.ID] = $true }
  $scenarioKey = ($row.Requirement + '|' + $row.Scenario).ToLowerInvariant() -replace '\s+', ' '
  if ($seenScenarios.ContainsKey($scenarioKey)) { $errors.Add("Repeated scenario for $($row.Requirement): $($row.Scenario)") } else { $seenScenarios[$scenarioKey] = $true }
  if ($row.Iteration -notin @('1','2','3','4')) { $errors.Add("$($row.ID): iteration must be 1-4.") }
  if ($row.Risk -notin @('must','high','artifact','optional')) { $errors.Add("$($row.ID): risk must be must, high, artifact, or optional.") }
  if ($row.Status -notin @('passed','failed','blocked')) { $errors.Add("$($row.ID): status must be passed, failed, or blocked after execution.") }
}

foreach ($round in 1..3) {
  $count = @($rows | Where-Object { $_.Iteration -eq [string]$round }).Count
  if ($count -eq 0) { $errors.Add("Iteration $round has no new executed cases.") }
  Write-Output "Iteration ${round}: $count distinct cases recorded"
}

$mustGroups = @($rows | Where-Object { $_.Risk -in @('must','high','artifact') } | Group-Object Requirement)
if ($mustGroups.Count -eq 0) { $errors.Add('No Must requirements are represented.') }
foreach ($group in $mustGroups) {
  $riskValues = @($group.Group | Select-Object -ExpandProperty Risk -Unique)
  if ($riskValues.Count -ne 1) { $errors.Add("$($group.Name): inconsistent risk labels."); continue }
  $risk = $riskValues[0]
  $minimum = if ($risk -eq 'high') { 6 } elseif ($risk -eq 'must') { 3 } else { 1 }
  if ($group.Count -lt $minimum) { $errors.Add("$($group.Name): $($group.Count) cases; needs at least $minimum.") }
  if ($risk -ne 'artifact') {
    foreach ($round in 1..3) {
      if (@($group.Group | Where-Object { $_.Iteration -eq [string]$round }).Count -eq 0) {
        $errors.Add("$($group.Name): no new case in iteration $round.")
      }
    }
  }
  foreach ($row in $group.Group) {
    if ($row.Status -ne 'passed') { $errors.Add("$($row.ID): Must case is $($row.Status), not passed.") }
  }
  Write-Output "$($group.Name) ($risk): $($group.Count) distinct cases"
}

$regressionLedger = Join-Path $Project 'REGRESSION_RUNS.md'
$regressionRows = @()
if (-not (Test-Path -LiteralPath $regressionLedger)) {
  $errors.Add("Missing $regressionLedger")
} else {
  $lineNumber = 0
  foreach ($line in (Get-Content -LiteralPath $regressionLedger)) {
    $lineNumber++
    if ($line -notmatch '^\s*\|') { continue }
    $cells = @($line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() })
    if ($cells[0] -in @('Iteration','---') -or $cells[0] -match '^:?-+:?$') { continue }
    if ($cells.Count -ne 7) { $errors.Add("Regression line ${lineNumber}: expected 7 cells, found $($cells.Count)."); continue }
    $regressionRows += [pscustomobject]@{
      Iteration=$cells[0]; Suite=$cells[1]; CaseIDs=$cells[2]
      Method=$cells[3]; Actual=$cells[4]; Status=$cells[5].ToLowerInvariant()
      Evidence=$cells[6]
    }
  }
}

$coreRows = @($regressionRows | Where-Object { $_.Suite -eq 'CORE' })
if ($coreRows.Count -eq 0) { $errors.Add('No CORE regression runs were recorded.') }
$coreIDs = @()
if ($coreRows.Count -gt 0) {
  $coreIDs = @($coreRows[0].CaseIDs.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  if ($coreIDs.Count -ne @($coreIDs | Select-Object -Unique).Count) { $errors.Add('CORE case ID list contains duplicates.') }
  foreach ($id in $coreIDs) {
    $case = @($rows | Where-Object { $_.ID -eq $id })
    if ($case.Count -ne 1) { $errors.Add("CORE case ID $id is missing or duplicated in QUALITY_CASES.md.") }
    elseif ($case[0].Iteration -ne '1') { $errors.Add("CORE case ID $id was not established in iteration 1.") }
  }
  foreach ($group in @($mustGroups | Where-Object { $_.Group[0].Risk -in @('must','high') })) {
    if (@($group.Group | Where-Object { $_.ID -in $coreIDs }).Count -eq 0) {
      $errors.Add("CORE suite omits $($group.Name).")
    }
  }
  $expectedIDs = (@($coreIDs | Sort-Object) -join ',')
  foreach ($row in $coreRows) {
    $actualIDs = (@($row.CaseIDs.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Sort-Object) -join ',')
    if ($actualIDs -ne $expectedIDs) { $errors.Add("CORE case IDs changed in iteration $($row.Iteration).") }
    foreach ($field in @('Iteration','CaseIDs','Method','Actual','Status','Evidence')) {
      if ([string]::IsNullOrWhiteSpace($row.$field) -or $row.$field -eq '-') { $errors.Add("CORE iteration $($row.Iteration): $field is empty.") }
    }
    if ($row.Iteration -notin @('1','2','3','4')) { $errors.Add("CORE iteration $($row.Iteration) is invalid.") }
    if ($row.Status -notin @('passed','failed','blocked')) { $errors.Add("CORE iteration $($row.Iteration): invalid status.") }
  }
  $requiredRounds = @(1,2,3)
  if (@($rows | Where-Object { $_.Iteration -eq '4' }).Count -gt 0) { $requiredRounds += 4 }
  $evidenceSeen = @{}
  foreach ($round in $requiredRounds) {
    $runs = @($coreRows | Where-Object { $_.Iteration -eq [string]$round })
    if ($runs.Count -eq 0) { $errors.Add("CORE suite was not rerun in iteration $round."); continue }
    $last = $runs[-1]
    if ($last.Status -ne 'passed') { $errors.Add("CORE iteration $round ended $($last.Status), not passed.") }
    if ($evidenceSeen.ContainsKey($last.Evidence)) { $errors.Add("CORE iteration $round reused an earlier evidence reference.") }
    else { $evidenceSeen[$last.Evidence] = $true }
    Write-Output "CORE iteration ${round}: $($last.Status) ($($coreIDs.Count) same cases)"
  }
}

if ($errors.Count -gt 0) {
  Write-Output 'QUALITY GATE: NOT READY'
  foreach ($item in $errors) { Write-Output "- $item" }
  exit 1
}
Write-Output "QUALITY GATE: READY ($($rows.Count) distinct executed cases plus repeated CORE checks)"
