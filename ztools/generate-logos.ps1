# Generate logos for all ztools plugins using GraphicsMagick
$base = "e:\test\demo-github\chrome_script\ztools"

# ===== 1. app-launcher: 蓝色背景 + 火箭造型 =====
gm.exe convert -size 256x256 `
  xc:"#2196F3" `
  -fill "#1976D2" -draw "roundrectangle 0,0 255,255 30,30" `
  -fill white -draw "polygon 128,40 88,160 128,140 168,160" `
  -fill white -draw "polygon 108,140 98,180 128,160" `
  -fill white -draw "polygon 148,140 158,180 128,160" `
  -fill "#FF5722" -draw "polygon 118,160 128,200 138,160" `
  -fill white -draw "circle 128,100 128,115" `
  "$base\app-launcher\logo.png"

# ===== 2. calculator-draft: 绿色背景 + 计算器 =====
gm.exe convert -size 256x256 `
  xc:"#4CAF50" `
  -fill "#388E3C" -draw "roundrectangle 0,0 255,255 30,30" `
  -fill white -draw "roundrectangle 68,38 188,218 12,12" `
  -fill "#4CAF50" -draw "roundrectangle 78,48 178,98 6,6" `
  -fill "#4CAF50" -draw "roundrectangle 78,108 108,138 4,4" `
  -fill "#4CAF50" -draw "roundrectangle 118,108 148,138 4,4" `
  -fill "#4CAF50" -draw "roundrectangle 158,108 178,138 4,4" `
  -fill "#4CAF50" -draw "roundrectangle 78,148 108,178 4,4" `
  -fill "#4CAF50" -draw "roundrectangle 118,148 148,178 4,4" `
  -fill "#4CAF50" -draw "roundrectangle 158,148 178,178 4,4" `
  -fill "#FF5722" -draw "roundrectangle 78,188 178,208 4,4" `
  -stroke "#4CAF50" -strokewidth 4 `
  -fill none -draw "line 128,58 128,88" `
  -draw "line 113,73 143,73" `
  "$base\calculator-draft\logo.png"

# ===== 3. swagger-finder: 紫色背景 + 放大镜 + 大括号 =====
gm.exe convert -size 256x256 `
  xc:"#673AB7" `
  -fill "#512DA8" -draw "roundrectangle 0,0 255,255 30,30" `
  -fill white `
  -draw "roundrectangle 58,50 148,180 8,8" `
  -fill "#673AB7" -draw "roundrectangle 66,58 140,172 4,4" `
  -fill white `
  -font "Consolas" -pointsize 60 `
  -draw "text 74,140 '{ }'" `
  -fill none -stroke white -strokewidth 10 `
  -draw "circle 170,80 170,110" `
  -draw "line 192,102 218,128" `
  "$base\swagger-finder\logo.png"

# ===== 4. url-formatter: 青色背景 + 表格网格 =====
gm.exe convert -size 256x256 `
  xc:"#009688" `
  -fill "#00796B" -draw "roundrectangle 0,0 255,255 30,30" `
  -fill white -draw "roundrectangle 38,38 218,218 10,10" `
  -fill "#009688" `
  -draw "roundrectangle 48,78 118,108 4,4" `
  -draw "roundrectangle 128,78 208,108 4,4" `
  -draw "roundrectangle 48,118 118,148 4,4" `
  -draw "roundrectangle 128,118 208,148 4,4" `
  -draw "roundrectangle 48,158 118,188 4,4" `
  -draw "roundrectangle 128,158 208,188 4,4" `
  -fill "#FF9800" -draw "roundrectangle 48,48 208,68 4,4" `
  "$base\url-formatter\logo.png"

# ===== 5. json-diff: 橙色背景 + 对比箭头 =====
gm.exe convert -size 256x256 `
  xc:"#FF5722" `
  -fill "#E64A19" -draw "roundrectangle 0,0 255,255 30,30" `
  -fill white -draw "roundrectangle 28,38 118,218 8,8" `
  -fill "#FF5722" -draw "roundrectangle 36,46 110,210 4,4" `
  -fill white -draw "roundrectangle 138,38 228,218 8,8" `
  -fill "#FF5722" -draw "roundrectangle 146,46 220,210 4,4" `
  -fill white -font "Consolas" -pointsize 36 `
  -draw "text 48,100 '{ }'" `
  -draw "text 158,100 '{ }'" `
  -fill "#4CAF50" `
  -draw "polygon 128,80 140,90 128,100" `
  -fill "#F44336" `
  -draw "polygon 128,140 116,150 128,160" `
  -fill white `
  -draw "line 124,90 128,90" `
  -draw "line 128,150 132,150" `
  "$base\json-diff\logo.png"

# ===== 6. html-render: 粉色背景 + 浏览器窗口 =====
gm.exe convert -size 256x256 `
  xc:"#E91E63" `
  -fill "#C2185B" -draw "roundrectangle 0,0 255,255 30,30" `
  -fill white -draw "roundrectangle 38,58 218,198 10,10" `
  -fill "#E91E63" -draw "roundrectangle 46,66 210,190 6,6" `
  -fill white -font "Consolas" -pointsize 32 `
  -draw "text 60,110 '</>'" `
  -fill "#FFC107" -draw "roundrectangle 38,42 218,62 6,6" `
  -fill "#E91E63" `
  -draw "circle 52,52 52,57" `
  -draw "circle 68,52 68,73" `
  -draw "circle 84,52 84,89" `
  "$base\html-render\logo.png"

Write-Host "All logos generated!"
