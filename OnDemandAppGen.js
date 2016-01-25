define( [
	"text!./appGen.html",
	"qvangular",
	"jquery",
	"client.models/rpc-session"
],
function ( appGenHtml, qvangular, $, RPCSession ) {

	return {
		initialProperties: {
			version: 1.0,
			qHyperCubeDef: {
				qDimensions: [],
				qMeasures: [],
				qInitialDataFetch: [{
					qWidth: 1,
					qHeight: 1
				}]
			}
		},
		definition: {
			type: "items",
			component: "accordion",
			items: {
				measures: {
					uses: "measures",
					min: 0,
					max: 1
				},
				advanced:{
					label: "Advanced",
					type: "items",
					items:{
						whereOperator: {
							ref: "advanced.whereOperator",
              translation: "Where Operator",
              type: "string"
						},
						inParentheses: {
							ref: "advanced.inParentheses",
              translation: "Values in Parentheses",
              type: "boolean",
							defaultValue: true
						},
						quoteCharacter: {
							ref: "advanced.quoteCharacter",
              translation: "Quote Character",
              type: "string"
						},
						delimeter: {
							ref: "advanced.delimeter",
              translation: "Value Delimeter",
              type: "string"
						}
					}
				}
			}
		},
		controller: function($scope){
			var session;
			var newAppSession;
			var handle;
			var newAppHandle;
			var newAppId;
			$scope.expressionSet = false;
			$scope.limitSet = false;
			$scope.rowCount = null;
			$scope.view = "nocondition";
			$scope.progress = "";
			$scope.lastError;
			$scope.errorCount;
			$scope.limit = 0;
			$scope.delimeter;
			$scope.inParentheses;
			$scope.quoteCharacter;
			$scope.whereOperator;
			$scope.newAppUrl;
      $scope.$parent.component.measureDefinition.items.limit = {
        type: "number",
        label: "Row Limit",
        ref: "qDef.limit",
        show: true
      };
			$scope.createApp = function(){
				$scope.view = "processing";
				$scope.errorCount = 0;
				session = $scope.backendApi.model.session;
				handle = session.currentApp.handle;
				var appId = session.currentApp.id;
				var appName = "";
				//get the app name
				$scope.logProgress("Copying App");
				session.rpc({handle: handle, method: "GetAppLayout", params:[]}).then(function(response){
					appName = response.result.qLayout.qTitle;
					//create the new App
					session.rpc({handle: -1, method: "CreateApp", params: [appName+"_appgen.qvf"]}).then(function(response){
						if(response.result.qSuccess==true){
							newAppId = response.result.qAppId;
							session.rpc({handle: -1, method: "CopyApp", params: [newAppId, appId,[]]}).then(function(response){
								//open the new app
								//setup a 2nd socket for working with the new app
								newAppSession = RPCSession.get(newAppId, {
									host: window.location.host,
									isSecure: window.location.protocol == "https:"
								});
								newAppSession.open();
								newAppSession.rpc({handle: -1, method: "OpenDoc", params:[newAppId]}).then(function(response){
									newAppHandle = response.result.qReturn.qHandle;
									session.rpc({
										handle: handle,
										method: "CreateSessionObject",
										params: [{
											"qAppObjectListDef": {
												"qType": "sheet",
												"qData": {
													"title": "/qMetaDef/title",
													"description": "/qMetaDef/description",
													"thumbnail": "/thumbnail",
													"cells": "/cells",
													"rank": "/rank",
													"columns": "/columns",
													"rows": "/rows"
												}
											},
											"qInfo": {
												"qId": "SheetList",
												"qType": "SheetList"
											}
										}]
									}).then(function(response) {
										session.rpc({
											handle: response.result.qReturn.qHandle,
											method: "GetLayout",
											params: []
										}).then(function(response) {
											var sheets = response.result.qLayout.qAppObjectList.qItems;
											$scope.copySheets(sheets, function(){
												//all copying functions finished so now we copy and update the script
												$scope.logProgress("Updating Script");
												$scope.updateScript(function(){
													$scope.reload();
												});
											});
										});
									});
								});
							});
						}
					});
				});
			};
			$scope.copySheets = function(sheets, callbackFn){
				var iter = 0;
				for (var i = 0; i < sheets.length; i++) {
					$scope.logProgress("Copying Sheet "+iter);
					$scope.copySheet(sheets[i], function(){
						iter++;
						if(iter==sheets.length){
							callbackFn.call(null);
						}
					});
				}
			}
			$scope.copySheet = function(sheet, callbackFn){
				newAppSession.rpc({handle: newAppHandle, method: "CreateObject", params: [{qInfo:sheet.qInfo}]}).then(function(newSheet){
					var newSheetHandle = newSheet.result.qReturn.qHandle;
					var sheetId = newSheet.result.qInfo.qId;
					$scope.getObject(handle, sheetId, function(oldSheet){
						$scope.getProperties(oldSheet.result.qReturn.qHandle, function(oldSheetProps){
							var sheetProps = oldSheetProps.result.qProp;
							//copy the objects from the sheet
							$scope.copyObjects(sheetProps, newSheetHandle, function(){
								callbackFn.call(null);
							});
						});
					});
				});
			}
			$scope.copyObjects = function(sheet, parentHandle, callbackFn){
				var oIter = 0;
				for( var o in sheet.cells){
					$scope.logProgress("Copying Objects");
					$scope.copyObject(sheet.cells[o], parentHandle, function(){
						oIter++;
						if(oIter==sheet.cells.length){
							newAppSession.rpc({handle: parentHandle, method: "SetProperties", params:[sheet]}).then(function(response){
								callbackFn.call(null);
							});
						}
					});
				}
			}
			$scope.copyObject = function(object, parentHandle, callbackFn){
				newAppSession.rpc({handle: parentHandle, method: "CreateChild", params:[{qInfo:{qId: object.name, qType: object.type}}]}).then(function(newObject){
					var newObjHandle = newObject.result.qReturn.qHandle;
					var objId = newObject.result.qInfo.qId;
					$scope.getObject(handle, objId, function(oldObject){
						$scope.getProperties(oldObject.result.qReturn.qHandle, function(oldObjectProps){
							var objProps = oldObjectProps.result.qProp;
							$scope.getLayout(oldObject.result.qReturn.qHandle, function(oldObjectLayout){
								var objLayout = oldObjectLayout.result.qLayout;
								var childList = []
								if(objLayout.qChildList){
									childList = objLayout.qChildList.qItems || [];
									objProps.qChildListDef = {qItems: objLayout.qChildList.qItems || []};
								}
								$scope.copyChildren(childList, newObjHandle, function(){
									newAppSession.rpc({handle: newObjHandle, method: "SetProperties", params:[objProps]}).then(function(response){
										callbackFn.call(null);
									});
								})
							});
						});
					});
				});
			}
			$scope.copyChildren = function(children, parentHandle, callbackFn){
				var cIter = 0;
				if(children.length > 0){
					for(c in children){
						$scope.copyChild(children[c], parentHandle, function(){
							cIter++;
							if(cIter == children.length){
								callbackFn.call(null);
							}
						});
					}
				}
				else{
					callbackFn.call(null);
				}
			}
			$scope.copyChild = function(child, parentHandle, callbackFn){
				newAppSession.rpc({handle: parentHandle, method: "CreateChild", params:[{qInfo:{qId: child.qInfo.qId, qType: child.qInfo.qType}}]}).then(function(newChild){
					var childId = newChild.result.qInfo.qId;
					var newChildHandle = newChild.result.qReturn.qHandle;
					$scope.getObject(handle, childId, function(oldChild){
						$scope.getProperties(oldChild.result.qReturn.qHandle, function(oldChildProps){
							var childProps = oldChildProps.result.qProp;
							newAppSession.rpc({handle: newChildHandle, method: "SetProperties", params:[childProps]}).then(function(response){
								callbackFn.call(null);
							});
						});
					});
				});
			}
			$scope.updateScript = function(callbackFn){
				$scope.getSelections(function(selectionData){
					var selections = selectionData.qSelectionObject.qSelections;
					session.rpc({handle: newAppHandle, method: "GetScript", params:[]}).then(function(scriptData){
						var script = scriptData.result.qScript;
							//first match LOAD statements
							var loads = script.match(/LOAD[\w\W]*?(?=;)/gim);
							for(var match in loads){
								var statement = loads[match];
								var newStatement = statement;
								//make sure it's not a preceding loads, in theory checking for 'FROM' should cover this
								if(statement.match(/\bFROM\b/i)){
									var whereClause = " ";
									//check to see if we have a field match from the current selections
									for (var s in selections){
										var field = selections[s].qField.replace(/\s/gim, "[^\\S]");	//(\byear[^\S]salary\b)
										var rex = new RegExp("\\b" + field + "\\b", "gim");
										if(statement.match(rex)){
											//the field exists in this statement so we add a where clause
											//if an existing WHERE clause exists we append to it
											if(statement.match(/\bWHERE\b/i) || whereClause.match(/\bWHERE\b/i)){
												whereClause += " and (";// + selections[s].qField + " IN ";
											}
											else{
												whereClause += " WHERE (";// + selections[s].qField + " IN (";
											}
											var filters = selections[s].qSelected.split(",");
											for (var f=0;f < filters.length; f++){
												whereClause += selections[s].qField + "='"+filters[f].trim()+"'";
												if(f<filters.length-1){
													whereClause+=" OR ";
												}
											}
											whereClause += ")";
										}
									}
									newStatement += whereClause;
									script = script.replace(statement, newStatement);
								}
							}
							//************************** SQL SELECT ************************
							//now match the SQL SELECT statements
							var selects = script.match(/SQL SELECT[\w\W]*?(?=;)/gim);
							for(var match in selects){
								var whereClause = " ";
								console.log('found select matches');
								var statement = selects[match];
								var newStatement = statement;
								for (var s in selections){
									var field = selections[s].qField.replace(/\s/gim, "[^\\S]");	//(\byear[^\S]salary\b)
									var rex = new RegExp("\\b" + field + "\\b", "gim");
									if(statement.match(rex)){

										//the field exists in this statement so we add a where clause
										//if an existing WHERE clause exists we append to it
										if(statement.match(/\bWHERE\b/i)){
											whereClause += " and " + selections[s].qField + " ";
										}
										else{
											whereClause += " WHERE " + selections[s].qField + " ";
										}
										whereClause += $scope.whereOperator;
										whereClause += ($scope.inParentheses==true?" (":" ");

										var filters = selections[s].qSelected.split(",");
										for (var f=0;f < filters.length; f++){
											whereClause += $scope.quoteCharacter +filters[f].trim()+ $scope.quoteCharacter;
											if(f<filters.length-1){
												whereClause += $scope.delimeter;
											}
										}
										whereClause += ($scope.inParentheses==true?") ":" ");
									}
								}
								newStatement += whereClause;
								script = script.replace(statement, newStatement);
							}
							newAppSession.rpc({handle: newAppHandle, method: "SetScript", params: [script]}).then(function(response){
								callbackFn.call(null);
							});
					});
				});
			}
			$scope.getSelections = function(callbackFn){
				$scope.getObject(handle, "CurrentSelection", function(selectionsObject){
					$scope.getLayout(selectionsObject.result.qReturn.qHandle, function(selectionsLayout){
						callbackFn.call(null, selectionsLayout.result.qLayout);
					});
				});
			}
			$scope.reload = function(){
				$scope.logProgress("Reloading App");
				newAppSession.rpc({handle: newAppHandle, method: "DoReload", params: []}).then(function(reloadStart){
					if(reloadStart.error){
						$scope.view = "error";
						$scope.lastError = "Could not start reload";
					}
					else{
						newAppSession.rpc({handle: -1, method: "GetProgress", params: [0]}).then(function(reloadProgress){
							if(reloadProgress.result.qProgressData.qFinished==true){
								if(reloadProgress.result.qProgressData.qPersistentProgressMessages){
									for (var i = 0; i < reloadProgress.result.qProgressData.qPersistentProgressMessages.length; i++) {
										switch(reloadProgress.result.qProgressData.qPersistentProgressMessages[i].qMessageCode){
											case 10:
											case 7:
												$scope.view = "error";
												$scope.lastError = "Reload - " + reloadProgress.result.qProgressData.qPersistentProgressMessages[i].qMessageParameters;
												return;
												break;
											default:
												break;
										}
									}
								}
								$scope.saveNewApp();
							}
						});
					}
				});
			}
			$scope.saveNewApp = function(){
				$scope.logProgress("Saving");
				newAppSession.rpc({handle: newAppHandle, method: "DoSave", params:[]}).then(function(response){
					$scope.view = "done";
					var url = "http";
					url += (session.options.isSecure==true?"s://":"://");
					url += session.options.host;
					url += (session.options.port!=null?":"+session.options.port:"");
					url += session.options.prefix;
					url += "sense/app/";
					url += newAppId;
					$scope.newAppUrl = url;
					newAppSession.close();
				});
			}
			$scope.getObject = function(docHandle, id, callbackFn){
				session.rpc({handle: docHandle, method: "GetObject", params: [id]}).then(function(getObjectResponse){
					if(getObjectResponse.error){
						$scope.logError(getObjectResponse.error);
					}
					callbackFn.call(null, getObjectResponse);
				}, function(error){
					$scope.logError(error);
				});
			}
			$scope.getProperties = function(objHandle, callbackFn){
				session.rpc({handle: objHandle, method: "GetProperties", params: []}).then(function(getPropertiesResponse){
					if(getPropertiesResponse.error){
						$scope.logError(getPropertiesResponse.error);
					}
					callbackFn.call(null, getPropertiesResponse);
				}, function(error){
					$scope.logError(error);
				});
			}
			$scope.getLayout = function(objHandle, callbackFn){
				session.rpc({handle: objHandle, method: "GetLayout", params: []}).then(function(getLayoutResponse){
					if(getLayoutResponse.error){
						$scope.logError(getLayoutResponse.error);
					}
					callbackFn.call(null, getLayoutResponse);
				}, function(error){
					$scope.logError(error);
				});
			}
			$scope.openNewApp = function(){
				window.location = $scope.newAppUrl;
			}
			$scope.acknowledgeError = function(){
				$scope.view = "ready";
			}
			$scope.logProgress = function(text){
				$scope.progress = text;
			}
			$scope.logError = function(text){
				$scope.errorCount++;
				$scope.view = "error";
				$scope.lastError = text;
				if($scope.errorCount==1){	//we only need to do this once
					newAppSession.close();
					session.rpc({handle: -1, method: "DeleteApp", params:[newAppId]}).then(function(response){

					});
				}
			}
    },
		//template: appGenHtml,
		paint: function ($element, layout) {
			//first we check to see if the row conditions have been met
			console.log(layout);
			this.$scope.whereOperator = layout.advanced.whereOperator || "IN";
			this.$scope.inParentheses = layout.advanced.inParentheses || true;
			this.$scope.quoteCharacter = layout.advanced.quoteCharacter || "'";
			this.$scope.delimeter = layout.advanced.delimeter || ",";
			if(layout.qHyperCube && layout.qHyperCube.qMeasureInfo.length > 0){
				this.$scope.expressionSet = true;
				if(layout.qHyperCube.qMeasureInfo[0].limit && layout.qHyperCube.qMeasureInfo[0].limit > 0){
					this.$scope.limitSet = true;
					this.$scope.limit = layout.qHyperCube.qMeasureInfo[0].limit;
				}
					console.log(layout.qHyperCube.qMeasureInfo[0]);
			}
			if(!this.$scope.expressionSet || !this.$scope.limitSet){
				this.$scope.view = "nocondition";
			}
			if(layout.qHyperCube.qDataPages[0]){
				if(layout.qHyperCube.qDataPages[0].qMatrix[0]){
					this.$scope.rowCount = layout.qHyperCube.qDataPages[0].qMatrix[0][0].qNum;
				}
			}
			if(this.$scope.rowCount && this.$scope.limit){
				if(this.$scope.rowCount > this.$scope.limit){
					this.$scope.view = "conditionnotmet";
				}
				else{
					this.$scope.view = "ready";
				}
			}
			var $compile = qvangular.getService("$compile");
			var comp = $compile(appGenHtml)(this.$scope);
			$element.html(comp);
		}
	};

} );
