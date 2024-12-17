!macro customHeader
    BrandingText "Fyenance - Personal Finance Planning"
    
    # Undefine only the bitmap paths
    !undef MUI_WELCOMEFINISHPAGE_BITMAP
    !undef MUI_UNWELCOMEFINISHPAGE_BITMAP
    !undef MUI_HEADERIMAGE_BITMAP
    
    # Redefine the bitmap paths (don't redefine MUI_HEADERIMAGE since it's already set)
    !define /redef MUI_WELCOMEFINISHPAGE_BITMAP "${PROJECT_DIR}\assets\images\installer-sidebar.bmp"
    !define /redef MUI_UNWELCOMEFINISHPAGE_BITMAP "${PROJECT_DIR}\assets\images\uninstaller-sidebar.bmp"
    !define /redef MUI_HEADERIMAGE_BITMAP "${PROJECT_DIR}\assets\images\installer-header.bmp"
    
    # Debug messages to verify paths
    !system 'echo Checking for sidebar image at: ${PROJECT_DIR}\assets\images\installer-sidebar.bmp'
    !system 'if exist "${PROJECT_DIR}\assets\images\installer-sidebar.bmp" (echo Found!) else (echo Not found!)'
    
    # Custom welcome page
    !define MUI_WELCOMEPAGE_TITLE "Welcome to Fyenance"
    !define MUI_WELCOMEPAGE_TEXT "This will install Fyenance on your computer.$\r$\n$\r$\nFyenance is your personal finance planning companion."
    
    # Custom finish page
    !define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    !define MUI_FINISHPAGE_RUN_TEXT "Launch Fyenance"
    !define MUI_FINISHPAGE_LINK "Visit Fyenance website"
    !define MUI_FINISHPAGE_LINK_LOCATION "https://www.fyenanceapp.com/"
!macroend