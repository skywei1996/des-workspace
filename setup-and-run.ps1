# DES React 项目快速启动脚本

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  DES 数字员工系统 - 全栈启动  " -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 检查环境
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "✗ 未找到 Node.js" -ForegroundColor Red; exit 1
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "✗ 未找到 Python" -ForegroundColor Red; exit 1
}

# 启动后端
Write-Host "正在启动后端服务..." -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList "backend/run.py" -WindowStyle Minimized
Write-Host "✓ 后端服务已在后台启动" -ForegroundColor Green

# 启动前端
Write-Host "正在启动前端服务..." -ForegroundColor Yellow
Set-Location -Path "react-des"
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 依赖安装成功，启动开发服务器..." -ForegroundColor Green
    npm run dev
} else {
    Write-Host "✗ 依赖安装失败" -ForegroundColor Red
}
