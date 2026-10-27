@echo off
chcp 65001 >nul
title GitHub Uploader - Asset and Maintenance System
cls

cd /d "%~dp0"

echo =======================================================================
echo   Asset and Maintenance Management System
echo   GitHub: https://github.com/flookoyza-star/asset-management-system.git
echo =======================================================================
echo.

:: 1. Initialize git if not already initialized
if not exist ".git" (
    echo [*] กำลังเริ่มต้นสร้าง Git Repository...
    git init -b main
    git remote add origin https://github.com/flookoyza-star/asset-management-system.git
    echo.
)

:: 2. Ensure remote origin is set
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    git remote add origin https://github.com/flookoyza-star/asset-management-system.git
)

:: 3. Add all files
echo [*] กำลังรวบรวมไฟล์ทั้งหมด [git add .]...
git add .

:: 4. Commit
echo [*] กำลังบันทึกการเปลี่ยนแปลง [git commit]...
git commit -m "Initial commit - Asset and Maintenance System with Camera and Reports"

:: 5. Push to GitHub
echo.
echo [*] กำลังส่งโค้ดขึ้น GitHub [git push -u origin main]...
git branch -M main
git push -u origin main

if %errorlevel% equ 0 goto success
goto failed

:success
echo.
echo =======================================================================
echo   [OK] อัปโหลดโค้ดขึ้น GitHub สำเร็จเรียบร้อยแล้ว!
echo   ตรวจสอบได้ที่: https://github.com/flookoyza-star/asset-management-system
echo =======================================================================
echo.
echo [วิธีเปิดใช้งานออนไลน์ฟรีผ่าน GitHub Pages]:
echo 1. เข้าไปที่ https://github.com/flookoyza-star/asset-management-system
echo 2. คลิกที่ Settings -^> Pages
echo 3. ที่หัวข้อ Branch เลือก main และโฟลเดอร์ /(root) แล้วกด Save
echo 4. รอประมาณ 1-2 นาที คุณจะได้ URL เว็บไซต์ออนไลน์พร้อมใช้งานทันที
echo.
goto end

:failed
echo.
echo =======================================================================
echo   [X] การ Push ไม่สำเร็จ กรุณาตรวจสอบ:
echo   1. สร้าง Repository บน GitHub แล้วหรือยังที่:
echo      https://github.com/new (ตั้งชื่อ asset-management-system)
echo   2. ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและการ Sign-in ของ Git
echo =======================================================================
goto end

:end
echo.
pause
