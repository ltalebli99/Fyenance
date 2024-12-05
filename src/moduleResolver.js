const path = require('path');
const Module = require('module');

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent) {
  if (request === '@supabase/supabase-js') {
    return originalResolveFilename(path.resolve(__dirname, '../node_modules/@supabase/supabase-js'), parent);
  }
  return originalResolveFilename(request, parent);
};