$ErrorActionPreference = "Stop"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

$root = "C:\Users\Michael Oloyede\Desktop\trackx"
$files = @(
  @{ doc = "$root\TrackX_Database_Report.docx"; pdf = "$root\TrackX_Database_Report.pdf" },
  @{ doc = "$root\TrackX_Software_Report.docx"; pdf = "$root\TrackX_Software_Report.pdf" }
)

foreach ($f in $files) {
  Write-Host "Opening $($f.doc)"
  $doc = $word.Documents.Open($f.doc, $false, $false)
  $doc.Fields.Update() | Out-Null
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
  $doc.Repaginate()
  $doc.Save()
  $pages = $doc.ComputeStatistics(2)
  Write-Host "  pages: $pages"
  $doc.ExportAsFixedFormat($f.pdf, 17)
  $doc.Close(0)
}

$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
Write-Host "done"
