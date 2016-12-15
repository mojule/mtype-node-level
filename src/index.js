'use strict'

const Adapter = require( './levelAdapter' )
const Store = require( 'mtype-node-store' )

const LocalStorageStore = ( name, options ) =>
  Store( name, Object.assign( {}, options, { Adapter } ) )

module.exports = LocalStorageStore
