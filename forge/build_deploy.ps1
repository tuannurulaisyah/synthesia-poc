# Start measuring execution time
$StartTime = Get-Date

$projectDir = Get-Location

Write-Output npm run build in \static\forge-synthesia
Set-Location -Path "$projectDir\static\forge-synthesia"
# npm install
npm run build

Write-Output Deploy to Development
Set-Location -Path "$projectDir"
# npm install
forge deploy -e development
Set-Location -Path "$projectDir"

$EndTime = Get-Date
$FinishedAt = Get-Date -Format "HH:mm:ss"
# Calculate the total execution time
$TotalExecutionTime = $EndTime - $StartTime

# Display the result
Write-Host "Total Execution Time: $TotalExecutionTime"
Write-Host "Finished at: $FinishedAt"