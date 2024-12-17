!macro customHeader
    BrandingText "Fyenance - Personal Finance Planning"
    
    # Undefine bitmap paths (these are already defined by electron-builder)
    !undef MUI_WELCOMEFINISHPAGE_BITMAP
    !undef MUI_UNWELCOMEFINISHPAGE_BITMAP
    !undef MUI_HEADERIMAGE_BITMAP
    
    # Redefine bitmap paths
    !define /redef MUI_WELCOMEFINISHPAGE_BITMAP "${PROJECT_DIR}\assets\images\installer-sidebar.bmp"
    !define /redef MUI_UNWELCOMEFINISHPAGE_BITMAP "${PROJECT_DIR}\assets\images\uninstaller-sidebar.bmp"
    !define /redef MUI_HEADERIMAGE_BITMAP "${PROJECT_DIR}\assets\images\installer-header.bmp"
    
    # Define welcome page (no need to undefine first)
    !define MUI_WELCOMEPAGE_TITLE "Welcome to Fyenance"
    !define MUI_WELCOMEPAGE_TEXT "This will install Fyenance on your computer.$\r$\n$\r$\nFyenance is your personal finance planning companion."
    
    # Define finish page (no need to undefine first)
    !define /redef MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    !define /redef MUI_FINISHPAGE_RUN_TEXT "Launch Fyenance"
    !define /redef MUI_FINISHPAGE_LINK "Visit Fyenance website"
    !define /redef MUI_FINISHPAGE_LINK_LOCATION "https://www.fyenanceapp.com/"
    
    # Debug messages
    !system 'echo Checking for sidebar image at: ${PROJECT_DIR}\assets\images\installer-sidebar.bmp'
    !system 'if exist "${PROJECT_DIR}\assets\images\installer-sidebar.bmp" (echo Found!) else (echo Not found!)'
!macroend