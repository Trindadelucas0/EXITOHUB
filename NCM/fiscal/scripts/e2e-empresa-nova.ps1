$ErrorActionPreference = "Continue"
$base = "http://localhost:3000"
$tmp = $env:TEMP
$jar = Join-Path $tmp "fiscal-e2e-cookies.txt"
if (Test-Path $jar) { Remove-Item $jar -Force }
$officeEmail = $args[0]
$officePass = $args[1]
$slug = "teste-e2e"

function Json($obj, $name) {
  $path = Join-Path $tmp "$name.json"
  ($obj | ConvertTo-Json -Compress) | Set-Content -Path $path -Encoding ASCII -NoNewline
  return $path
}

function Http {
  param([string]$Label, [string[]]$Extra)
  $out = & curl.exe -s -b $jar -c $jar @Extra
  if ($out -and $out.Length -gt 420) { $short = $out.Substring(0, 420) + "..." } else { $short = $out }
  Write-Host "--- $Label"
  Write-Host $short
  return $out
}

Http "1. login escritorio" @("-X", "POST", "$base/api/auth/login", "-H", "Content-Type: application/json", "-d", "@$(Json @{email=$officeEmail;password=$officePass} 'login-office')") | Out-Null

$nova = Json @{
  name = "Empresa Teste E2E"; slug = $slug; adminName = "Admin Teste"
  adminEmail = "admin@teste-e2e.com.br"; adminPassword = "senhaforte123"
} 'nova-empresa'
Http "2. cria empresa" @("-X", "POST", "$base/api/companies", "-H", "Content-Type: application/json", "-d", "@$nova") | Out-Null

$list = & curl.exe -s -b $jar -c $jar "$base/api/companies" | ConvertFrom-Json
$novoId = ($list.data.companies | Where-Object { $_.slug -eq $slug }).id
Write-Host "--- id da empresa nova: $novoId"

Http "3. escritorio entra na empresa nova" @("-X", "POST", "$base/api/auth/select-company", "-H", "Content-Type: application/json", "-d", "@$(Json @{companyId=$novoId} 'sel-nova')") | Out-Null
Http "4. dashboard da empresa vazia" @("$base/api/dashboard") | Out-Null
Http "5. importa base fiscal (regras NCM)" @("-X", "POST", "$base/api/rules/import", "-F", "file=@data/ok-baifer.xlsx") | Out-Null
Http "6. importa cadastro de produtos" @("-X", "POST", "$base/api/import", "-F", "file=@data/cadastro-cliente-baifer.xlsx") | Out-Null
Http "7. dashboard depois da importacao" @("$base/api/dashboard") | Out-Null
Http "8. produtos" @("$base/api/products?pageSize=2") | Out-Null
Http "9. resumo por NCM" @("$base/api/products/ncm-summary?pageSize=2") | Out-Null

Http "10. escritorio volta para a BAIFER" @("-X", "POST", "$base/api/auth/select-company", "-H", "Content-Type: application/json", "-d", "@$(Json @{companyId='cm_baifer_seed_company'} 'sel-baifer')") | Out-Null
Http "11. dashboard da BAIFER (deve seguir com os numeros dela)" @("$base/api/dashboard") | Out-Null

$jar = Join-Path $tmp "fiscal-e2e-cookies2.txt"
if (Test-Path $jar) { Remove-Item $jar -Force }
Http "12. login do admin da empresa nova" @("-X", "POST", "$base/api/auth/login", "-H", "Content-Type: application/json", "-d", "@$(Json @{email='admin@teste-e2e.com.br';password='senhaforte123'} 'login-nova')") | Out-Null
Http "13. dashboard como admin da empresa nova" @("$base/api/dashboard") | Out-Null
Http "14. GET /api/companies como admin da empresa (espera 403)" @("$base/api/companies") | Out-Null
