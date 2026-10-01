@echo off
call "%~dp0mrz.cmd" stop %*
if errorlevel 1 pause
