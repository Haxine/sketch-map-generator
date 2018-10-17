var pluginIdentifier = 'io.eduardogomez.sketch.map-generator';
var app = NSApplication.sharedApplication();

/**
 * Checks if there is something selected.
 * @param  {Sketch context} context 
 * @return {Boolean}         
 */
function checkCount (context) {
  if (context.selection.count() != 1) {
    app.displayDialog_withTitle('You have to select 1 shape layer.', 'Wrong shape layer selection');
    return false;
  }

  return true;
}

/**
 * Checks if the item selected is a shape layer or not.
 * @param  {Sketch context} context 
 * @return {Boolean}         
 */
function checkLayerType (context) {
  var layer = context.selection[0];

  if ((MSApplicationMetadata.metadata().appVersion >= 52)) {
    var edited = layer.edited;

    if (edited == undefined) {
      app.displayDialog_withTitle('Your selection was a “' + [layer name] + '”, that is not a shape layer. Please select a shape layer.', 'Shape layer only');
      return false;
    }
  } else {
    if ([layer class] != MSShapeGroup) {
      app.displayDialog_withTitle('Your selection was a “' + [layer name] + '”, that is not a shape layer. Please select a shape layer.', 'Shape layer only');
      return false;
    }
  }

  return true;
}

/**
 * Checks if there are valid settings and if the user wrote an address.
 * @param  {Object} settings 
 * @param  {COSAlertWindow} dialog   
 * @return {Boolean}          
 */
function checkSettings (settings) {
  if (settings.address.length() === 0) {
    app.displayDialog_withTitle('Please enter a valid address.', 'Invalid address');
    return false;
  }

  return true;
}

function buildWindow (size, title) {
  var window = [[[NSWindow alloc]
        initWithContentRect: NSMakeRect(0, 0, size, size)
        styleMask: NSWindowStyleMaskTitled | NSWindowStyleMaskClosable
        backing: NSBackingStoreBuffered
        defer: false
  ] autorelease];

  [window setTitle: title];
  window.center();
  window.makeKeyAndOrderFront_(window);

  return window;
}

function createLabel (text, rect) {
  var label = [[NSTextField alloc] init];

  [label setEditable: false];
  [label setBordered: false];
  [label setDrawsBackground: false];
  [label setStringValue: text];
  [label sizeToFit];
  [label setFrame: NSMakeRect(rect.left, rect.top, rect.width, rect.height)];

  return label;
}

function createField (rect, value) {
  var field = [[NSTextField alloc] initWithFrame: NSMakeRect(rect.left, rect.top, rect.width, rect.height)];

  [field setStringValue: value];

  return field;
}

/**
 * Creates a select box with options.
 * @param  {Array} options       
 * @param  {Integer} selectedIndex 
 * @param  {Integer} width         
 * @return {NSPopUpButton}               
 */
function createSelect (options, selectedIndex, rect) {
  var selectedItemIndex = selectedIndex || 0;
  var select = NSPopUpButton.alloc().initWithFrame(NSMakeRect(rect.left, rect.top, rect.width, rect.height));

  if (options) {
    select.addItemsWithTitles(options);
    select.selectItemAtIndex(selectedItemIndex);
  }

  return select;
}

/**
 * Creates a checkbox.
 * @param  {String} title   
 * @param  {Integer} checked 
 * @return {NSButton}         
 */
function createCheck (title, checked, rect) {
  var checkbox = NSButton.alloc().initWithFrame(NSMakeRect(rect.left, rect.top, rect.width, rect.height));

  checkbox.setButtonType(NSSwitchButton);
  checkbox.setBezelStyle(NSRoundedBezelStyle);
  checkbox.setTitle(title);
  checkbox.setState(checked == 0 ? NSOffState : NSOnState);

  return checkbox;
}

function createButton (title, rect) {
  var button = NSButton.alloc().initWithFrame(NSMakeRect(rect.left, rect.top, rect.width, rect.height));

  button.setBezelStyle(1);
  button.setTitle(title);

  return button;
}

function createWebView (url, context) {
  var webviewFolder = context.scriptPath.stringByDeletingLastPathComponent() + '/webview/';
  var webviewHtmlFile = webviewFolder + url;
  var requestUrl = [NSURL fileURLWithPath: webviewHtmlFile];
  var urlRequest = [NSMutableURLRequest requestWithURL: requestUrl];
  var webView = WebView.new();

  webView.initWithFrame(NSMakeRect(0, 0, 800, 450));
  webView.mainFrame().loadRequest(urlRequest);

  return webView;
}

/**
 * Fills the zoom level arrays with the data passed.
 * @param  {Array} zoomLevels 
 * @param  {Integer} minZoom    
 * @param  {Integer} maxZoom     
 */
function makeZoomLevels(zoomLevels, minZoom, maxZoom) {
  if (zoomLevels.length > 0) {
    return;
  }

  for (var x = minZoom; x <= maxZoom; x++) {
    zoomLevels.push(x.toString());
  }
}

function handleButtonAction (viewElements, service, shouldSave) {
  if (shouldSave) {
    saveData(viewElements, service);
  }

  var result = {};

  for (var x = 0; x < viewElements.length; x++) {
    if (viewElements[x].type === 'select') {
      result[viewElements[x].key] = viewElements[x].component.titleOfSelectedItem();
    } else if (viewElements[x].type === 'input') {
      result[viewElements[x].key] = viewElements[x].component.stringValue();
    }
  }

  if (!checkSettings(result)) {
    return null;
  }

  return result;
}

/**
 * Fills a shape layer with a static map.
 * @param  {String} imageUrl 
 * @param  {MSShapeGroup} layer    
 * @param  {Sketch context} context  
 */
function fillLayerWithImage (imageUrl, layer, context) {
  var imageData = getImage(imageUrl);

  if (!imageData) {
    context.document.showMessage('There was a problem, please check your Internet connection or the address settings.');
    return;
  }

  var result = NSString.alloc().initWithData_encoding(imageData, NSUTF8StringEncoding);

  if (result) {
    context.document.showMessage('There was a problem, please check the address settings.');
    return;
  }

  var imageFile = NSImage.alloc().initWithData(imageData);
  var fill = layer.style().fills().firstObject();

  fill.setFillType(4);

  if (MSApplicationMetadata.metadata().appVersion < 47) {
    fill.setImage(MSImageData.alloc().initWithImageConvertingColorSpace(imageFile));
  } else {
    fill.setImage(MSImageData.alloc().initWithImage(imageFile));
  }
  
  fill.setPatternFillType(1);

  context.document.showMessage('Map generated!');
}

/**
 * Gets the image data from a url.
 * @param  {String} url 
 * @return {Response}     
 */
function getImage (url) {
  var request = NSURLRequest.requestWithURL(NSURL.URLWithString(url));
  var response = NSURLConnection.sendSynchronousRequest_returningResponse_error(request, null, null);

  return response;
}

/**
 * Gets the coordinates from a given location.
 * @param  {String} address 
 * @param  {Sketch context} context
 * @return {Object}         
 */
function getGeoCode (address, context) {
  var data = JSON.stringify({
    query: decodeURIComponent(address),
    hitsPerPage: 1
  });

  var dataParsed = networkRequest(['-X', 'POST', 'https://places-dsn.algolia.net/1/places/query', '-H', 'Content-Type: application/json; charset=utf-8', '-d', data]);

  if (dataParsed.hits.length === 0) {
    context.document.showMessage('Address not found, please try another one.');
    return;
  }

  return {
    lat: dataParsed.hits[0]._geoloc.lat,
    lon: dataParsed.hits[0]._geoloc.lng
  };
}

/**
 * Saves the address settings.    
 * @param  {Array} viewElements 
 * @param  {String} service      
 */
function saveData (viewElements, service) {
  for (var x = 0; x < viewElements.length; x++) {
    if (viewElements[x].type === 'select') {
      setPreferences(service + '.' + viewElements[x].key, viewElements[x].component.indexOfSelectedItem());
    } else if (viewElements[x].type === 'input') {
      setPreferences(service + '.' + viewElements[x].key, viewElements[x].component.stringValue());
    }
  }
}

/**
 * Gets an option value.
 * @param  {String} key          
 * @param  {String | Integer} defaultValue 
 * @param  {String} service      
 * @return {String}              
 */
function getOption(key, defaultValue, service) {
  return getPreferences(service + '.' + key, defaultValue);
}

/**
 * Gets an address setting from the user preferences.
 * @param  {String} key          
 * @param  {String | Integer} defaultValue 
 * @return {String}              
 */
function getPreferences(key, defaultValue) {
  var userDefaults = NSUserDefaults.standardUserDefaults();

  if (!userDefaults.dictionaryForKey(pluginIdentifier)) {
    var defaultPreferences = NSMutableDictionary.alloc().init();

    userDefaults.setObject_forKey(defaultPreferences, pluginIdentifier);
    userDefaults.synchronize();
  }

  var value = userDefaults.dictionaryForKey(pluginIdentifier).objectForKey(key);

  return (value === null) ? defaultValue : value;
}

/**
 * Saves an address setting to the user preferences.
 * @param {String} key   
 * @param {String} value 
 */
function setPreferences(key, value) {
  var userDefaults = NSUserDefaults.standardUserDefaults();
  var preferences;

  if (!userDefaults.dictionaryForKey(pluginIdentifier)) {
    preferences = NSMutableDictionary.alloc().init();
  } else {
    preferences = NSMutableDictionary.dictionaryWithDictionary(userDefaults.dictionaryForKey(pluginIdentifier));
  }

  preferences.setObject_forKey(value, key);

  userDefaults.setObject_forKey(preferences, pluginIdentifier);
  userDefaults.synchronize();
}

/**
 * Creates a network request using Curl and returns the fetched data.
 * @param {Array} args 
 * @return {Json Object} 
 */
function networkRequest(args) {
  var task = NSTask.alloc().init();
  task.setLaunchPath('/usr/bin/curl');
  task.setArguments(args);

  var outputPipe = [NSPipe pipe];
  [task setStandardOutput: outputPipe];
  task.launch();

  var responseData = [[outputPipe fileHandleForReading] readDataToEndOfFile];
  var responseString = [[[NSString alloc] initWithData: responseData encoding: NSUTF8StringEncoding]];
  var parsed = tryParseJSON(responseString);

  if (!parsed) {
    log('Error invoking curl');
    log('args:');
    log(args);
    log(responseString);
    throw 'Error communicating with server';
  }

  return parsed;
}

/**
 * Parses a string to Object.
 * @param {String} jsonString 
 * @return {Object} 
 */
function tryParseJSON(jsonString) {
  try {
    var o = JSON.parse(jsonString);

    if (o && typeof o === 'object' && o !== null) {
      return o;
    }
  }
  catch (e) { }

  return false;
}

function createMapJavascriptFile(options, context) {
  var addressInfo = {
    address: '' + options.address,
    zoom: '' + options.zoom,
    type: '' + options.type,
    style: '' + options.style.trim().replace(/\n|\r|\t|\s{2,}/g, '')
  }
  var jsContent = 'window.mapData = ' + JSON.stringify(addressInfo) + ';';
  var jsContentNSSString = [NSString stringWithFormat: '%@', jsContent];
  var jsContentFilePath = context.scriptPath.stringByDeletingLastPathComponent() + '/webview/mapData.js';

  [jsContentNSSString 
    writeToFile: jsContentFilePath 
    atomically: true 
    encoding: NSUTF8StringEncoding 
    error: nil
  ];
}
