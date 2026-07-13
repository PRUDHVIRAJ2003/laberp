@echo off
title LAB ERP - Local WhatsApp Gateway
echo =======================================================
echo     LAB ERP Local WhatsApp Server (whatsapp-web.js)
echo =======================================================
echo.
echo Starting the headless Chrome browser and WhatsApp engine...
echo Please leave this window open to keep the service running 24/7.
echo.
node scripts/whatsapp-local.js
pause
