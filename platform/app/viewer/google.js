window.config={routerBasename:"/",enableGoogleCloudAdapter:!1,showWarningMessageForCrossOrigin:!0,showCPUFallbackMessage:!0,showLoadingIndicator:!0,strictZSpacingForVolumeViewport:!0,oidc:[{authority:"https://accounts.google.com",client_id:"723928408739-k9k9r3i44j32rhu69vlnibipmmk9i57p.apps.googleusercontent.com",redirect_uri:"/callback",response_type:"id_token token",scope:"email profile openid https://www.googleapis.com/auth/cloudplatformprojects.readonly https://www.googleapis.com/auth/cloud-healthcare",post_logout_redirect_uri:"/logout-redirect.html",revoke_uri:"https://accounts.google.com/o/oauth2/revoke?token=",automaticSilentRenew:!0,revokeAccessTokenOnSignout:!0}],extensions:[],modes:[],showStudyList:!0,defaultDataSourceName:"dicomweb",dataSources:[{namespace:"@ohif/extension-default.dataSourcesModule.dicomweb",sourceName:"dicomweb",configuration:{friendlyName:"dcmjs DICOMWeb Server",name:"GCP",wadoUriRoot:"https://healthcare.googleapis.com/v1/projects/ohif-cloud-healthcare/locations/us-east4/datasets/ohif-qa-dataset/dicomStores/ohif-qa-2/dicomWeb",qidoRoot:"https://healthcare.googleapis.com/v1/projects/ohif-cloud-healthcare/locations/us-east4/datasets/ohif-qa-dataset/dicomStores/ohif-qa-2/dicomWeb",wadoRoot:"https://healthcare.googleapis.com/v1/projects/ohif-cloud-healthcare/locations/us-east4/datasets/ohif-qa-dataset/dicomStores/ohif-qa-2/dicomWeb",qidoSupportsIncludeField:!0,imageRendering:"wadors",thumbnailRendering:"wadors",enableStudyLazyLoad:!0,supportsFuzzyMatching:!0,supportsWildcard:!1,dicomUploadEnabled:!0,omitQuotationForMultipartRequest:!0,configurationAPI:"ohif.dataSourceConfigurationAPI.google"}},{namespace:"@ohif/extension-default.dataSourcesModule.dicomjson",sourceName:"dicomjson",configuration:{friendlyName:"dicom json",name:"json"}},{namespace:"@ohif/extension-default.dataSourcesModule.dicomlocal",sourceName:"dicomlocal",configuration:{friendlyName:"dicom local"}}]};