Add-Type -AssemblyName System.Drawing

# Memory Box icon: a warm wooden keepsake box with a rose ribbon, drawn flat.
# Everything is composed from simple shapes so the icon stays crisp at every size.

function New-Canvas {
  param([int]$Size)
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  return @{ Bitmap = $bmp; Graphics = $g }
}

function New-RoundRect {
  param([double]$X, [double]$Y, [double]$W, [double]$H, [double]$R)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $R * 2
  $path.AddArc([float]$X, [float]$Y, [float]$d, [float]$d, 180, 90)
  $path.AddArc([float]($X + $W - $d), [float]$Y, [float]$d, [float]$d, 270, 90)
  $path.AddArc([float]($X + $W - $d), [float]($Y + $H - $d), [float]$d, [float]$d, 0, 90)
  $path.AddArc([float]$X, [float]($Y + $H - $d), [float]$d, [float]$d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-LinearBrush {
  param([double]$X1, [double]$Y1, [double]$X2, [double]$Y2, [string]$From, [string]$To)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF([float]$X1, [float]$Y1)),
    (New-Object System.Drawing.PointF([float]$X2, [float]$Y2)),
    [System.Drawing.ColorTranslator]::FromHtml($From),
    [System.Drawing.ColorTranslator]::FromHtml($To)
  )
  return $brush
}

# Draws the keepsake box. $scaleFactor lets the same shape serve the full-bleed
# icon and the smaller adaptive-icon safe zone.
function Draw-Box {
  param($Graphics, [double]$Size, [double]$Scale, [switch]$Monochrome, [switch]$Foreground)

  $cx = $Size / 2
  $cy = $Size / 2
  $w = $Size * 0.60 * $Scale
  $h = $Size * 0.44 * $Scale
  $x = $cx - $w / 2
  $y = $cy - $h / 2 + $Size * 0.03 * $Scale
  $r = $Size * 0.06 * $Scale
  $lidH = $h * 0.26

  # Overall silhouette: lid slab stacked on the body.
  $top = $y - $lidH

  if ($Monochrome) {
    # A themed icon is one flat ink, so the box must read from its silhouette
    # alone: the lid stays solid, and thin cuts carve the lid seam and ribbon.
    $ink = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $silhouette = New-RoundRect $x $top $w ($h + $lidH) $r
    $Graphics.FillPath($ink, $silhouette)
    $silhouette.Dispose()

    $Graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $cut = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Transparent)

    # Lid seam.
    $seamY = $top + $lidH * 1.08
    $seamH = $w * 0.022
    $Graphics.FillRectangle($cut, [float]$x, [float]$seamY, [float]$w, [float]$seamH)

    # Ribbon running from the seam to the base.
    $ribbonW = $w * 0.105
    $Graphics.FillRectangle(
      $cut,
      [float]($cx - $ribbonW / 2),
      [float]$seamY,
      [float]$ribbonW,
      [float]($top + $lidH + $h - $seamY)
    )

    # Bow: two loops and a knot, cut above the seam so they stay legible.
    $knotY = $seamY
    $loopW = $w * 0.23
    $loopH = $w * 0.125
    foreach ($ang in @(-26.0, 26.0)) {
      $state = $Graphics.Save()
      $Graphics.TranslateTransform([float]$cx, [float]$knotY)
      $Graphics.RotateTransform([float]$ang)
      $offsetX = if ($ang -lt 0) { -$loopW * 0.54 } else { $loopW * 0.54 }
      $Graphics.FillEllipse($cut, [float]($offsetX - $loopW / 2), [float](-$loopH / 2), [float]$loopW, [float]$loopH)
      $Graphics.Restore($state)
    }
    $knotR = $w * 0.05
    $Graphics.FillEllipse($cut, [float]($cx - $knotR), [float]($knotY - $knotR), [float]($knotR * 2), [float]($knotR * 2))

    $Graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $cut.Dispose()
    $ink.Dispose()
    return
  }

  # Soft shadow under the box. The adaptive foreground gets cropped by the
  # launcher's mask, which would slice the shadow into a grey crescent.
  if (-not $Foreground) {
    $shadow = New-RoundRect ($x + $Size * 0.008) ($top + $Size * 0.026) $w ($h + $lidH) $r
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(42, 84, 50, 26))
    $Graphics.FillPath($shadowBrush, $shadow)
    $shadowBrush.Dispose()
    $shadow.Dispose()
  }

  # Body first, so the lid can overlap its top edge.
  $bodyPath = New-RoundRect $x ($top + $lidH * 0.7) $w ($h + $lidH * 0.3) $r
  $bodyBrush = New-LinearBrush $x $top ($x + $w) ($top + $h + $lidH) '#A96F3F' '#7E4A28'
  $Graphics.FillPath($bodyBrush, $bodyPath)
  $bodyBrush.Dispose()
  $bodyPath.Dispose()

  # Front panel, inset, so the box reads as a face rather than a brown slab.
  $inset = $w * 0.09
  $panelTop = $top + $lidH * 1.16
  $panelPath = New-RoundRect ($x + $inset) $panelTop ($w - $inset * 2) ($h + $lidH * 0.3 - $lidH * 0.86) ($r * 0.45)
  $panelBrush = New-LinearBrush $x $panelTop ($x + $w) ($panelTop + $h) '#C08A58' '#94602F'
  $Graphics.FillPath($panelBrush, $panelPath)
  $panelBrush.Dispose()
  $panelPath.Dispose()

  # Lid slab with its own warm gradient; overlapping the body keeps a crisp seam.
  $lidPath = New-RoundRect $x $top $w ($lidH * 1.25) ($r * 0.9)
  $lidBrush = New-LinearBrush $x $top ($x + $w) ($top + $lidH) '#D6A16B' '#AC7242'
  $Graphics.FillPath($lidBrush, $lidPath)
  $lidBrush.Dispose()
  $lidPath.Dispose()

  # Lid highlight along its top edge.
  $glossPath = New-RoundRect ($x + $w * 0.06) ($top + $lidH * 0.06) ($w * 0.88) ($lidH * 0.22) ($lidH * 0.11)
  $glossBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 255, 244, 230))
  $Graphics.FillPath($glossBrush, $glossPath)
  $glossBrush.Dispose()
  $glossPath.Dispose()

  # Rose ribbon from the top of the lid to the base, kept inside the box.
  $ribbonW = $w * 0.115
  $ribbonTop = $top + $lidH * 0.12
  $ribbonH = $h + $lidH * 0.72
  $ribbonPath = New-RoundRect ($cx - $ribbonW / 2) $ribbonTop $ribbonW $ribbonH ($ribbonW * 0.14)
  $ribbonBrush = New-LinearBrush ($cx - $ribbonW) $ribbonTop ($cx + $ribbonW) ($ribbonTop + $ribbonH) '#F472B6' '#BE123C'
  $Graphics.FillPath($ribbonBrush, $ribbonPath)
  $ribbonBrush.Dispose()
  $ribbonPath.Dispose()

  # Bow: two leaf-shaped loops tilted away from a centre knot.
  $knotY = $ribbonTop + $ribbonH * 0.22
  $loopW = $ribbonW * 1.9
  $loopH = $ribbonW * 1.05
  $loopBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#F472B6'))
  $loopInk = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#EC4899'), [float]($Size * 0.004 * $Scale))
  $loopInk.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $loops = @(
    @{ Ang = -24.0; Dir = -1.0 },
    @{ Ang = 24.0; Dir = 1.0 }
  )
  foreach ($loop in $loops) {
    $state = $Graphics.Save()
    $Graphics.TranslateTransform([float]$cx, [float]$knotY)
    $Graphics.RotateTransform([float]$loop.Ang)
    $offsetX = if ($loop.Dir -lt 0) { -$loopW * 0.52 } else { $loopW * 0.52 }
    # Dimmer on the far side so the bow reads with a little depth.
    $loopBrush.Color = [System.Drawing.ColorTranslator]::FromHtml(
      $(if ($loop.Dir -lt 0) { '#F9A8D4' } else { '#F472B6' })
    )
    $Graphics.FillEllipse($loopBrush, [float]($offsetX - $loopW / 2), [float](-$loopH / 2), [float]$loopW, [float]$loopH)
    $Graphics.DrawEllipse($loopInk, [float]($offsetX - $loopW / 2), [float](-$loopH / 2), [float]$loopW, [float]$loopH)
    $Graphics.Restore($state)
  }
  $loopBrush.Dispose()
  $loopInk.Dispose()

  # The knot: a solid rose circle tying both loops to the ribbon.
  $knotR = $ribbonW * 0.62
  $knotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#BE123C'))
  $Graphics.FillEllipse($knotBrush, [float]($cx - $knotR), [float]($knotY - $knotR), [float]($knotR * 2), [float]($knotR * 2))
  $knotBrush.Dispose()
}

function Save-Png {
  param($Bitmap, [string]$Path)
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root 'assets'

# 1. Full icon: cream paper, soft vignette, box.
$icon = New-Canvas 1024
$bgBrush = New-LinearBrush 0 0 1024 1024 '#FFFDF8' '#F6EBDA'
$icon.Graphics.FillRectangle($bgBrush, 0, 0, 1024, 1024)
$bgBrush.Dispose()
$warm = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 244, 114, 182))
$icon.Graphics.FillEllipse($warm, -140, 620, 640, 640)
$warm.Dispose()
Draw-Box $icon.Graphics 1024 1.0
Save-Png $icon.Bitmap (Join-Path $assets 'icon.png')
$icon.Graphics.Dispose()
$icon.Bitmap.Dispose()

# 2. Adaptive foreground: transparent, box inside the 66% safe circle.
$fg = New-Canvas 1024
Draw-Box $fg.Graphics 1024 0.78 -Foreground
Save-Png $fg.Bitmap (Join-Path $assets 'android-icon-foreground.png')
$fg.Graphics.Dispose()
$fg.Bitmap.Dispose()

# 3. Adaptive background: flat cream, matching the app's paper.
$bg = New-Canvas 1024
$bg.Graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#FDFBF7'))
Save-Png $bg.Bitmap (Join-Path $assets 'android-icon-background.png')
$bg.Graphics.Dispose()
$bg.Bitmap.Dispose()

# 4. Monochrome layer: a single-ink silhouette.
$mono = New-Canvas 1024
$mono.Graphics.Clear([System.Drawing.Color]::Transparent)
Draw-Box $mono.Graphics 1024 0.78 -Monochrome
Save-Png $mono.Bitmap (Join-Path $assets 'android-icon-monochrome.png')
$mono.Graphics.Dispose()
$mono.Bitmap.Dispose()

# 5. Splash mark and favicon, same artwork at other sizes.
$splash = New-Canvas 1024
$splash.Graphics.Clear([System.Drawing.Color]::Transparent)
Draw-Box $splash.Graphics 1024 0.92
Save-Png $splash.Bitmap (Join-Path $assets 'splash-icon.png')
$splash.Graphics.Dispose()
$splash.Bitmap.Dispose()

$fav = New-Canvas 48
$fav.Graphics.Clear([System.Drawing.Color]::Transparent)
Draw-Box $fav.Graphics 48 0.94
Save-Png $fav.Bitmap (Join-Path $assets 'favicon.png')
$fav.Graphics.Dispose()
$fav.Bitmap.Dispose()

Write-Output 'Icons written.'
