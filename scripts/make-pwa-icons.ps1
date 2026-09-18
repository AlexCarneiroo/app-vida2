Add-Type -AssemblyName System.Drawing

function Make-Icon([int]$Size, [string]$Path) {
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 10, 61, 58))
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 45, 212, 168))
  $penWidth = [Math]::Max(2, [int]($Size / 16))
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 240, 230, 216), $penWidth)
  $pen.StartCap = 'Round'
  $pen.EndCap = 'Round'
  $pen.LineJoin = 'Round'
  $m = $Size / 8.0
  $pts = @(
    (New-Object System.Drawing.PointF ($m * 2), ($m * 5.5)),
    (New-Object System.Drawing.PointF ($m * 3.2), ($m * 2.5)),
    (New-Object System.Drawing.PointF ($m * 4), ($m * 4.5)),
    (New-Object System.Drawing.PointF ($m * 4.8), ($m * 2.5)),
    (New-Object System.Drawing.PointF ($m * 6), ($m * 5.5))
  )
  $g.DrawLines($pen, $pts)
  $g.FillEllipse($brush, ($m * 5.4), ($m * 2), ($m * 1.1), ($m * 1.1))
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  $pen.Dispose()
  $brush.Dispose()
}

Make-Icon 192 "C:\Users\Alex\App-vida\public\pwa-192.png"
Make-Icon 512 "C:\Users\Alex\App-vida\public\pwa-512.png"
Write-Output "icons ok"
