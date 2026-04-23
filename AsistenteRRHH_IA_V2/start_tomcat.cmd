@echo off
set "JAVA_HOME=C:\Program Files\Java\jdk1.8.0_202"
set "CATALINA_HOME=C:\Program Files\Apache Software Foundation\Apache Tomcat 8.0.27"
echo Starting Tomcat...
cd /d "%CATALINA_HOME%\bin"
call catalina.bat run
pause
