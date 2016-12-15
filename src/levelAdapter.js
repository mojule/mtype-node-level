'use strict'

const path = require( 'path' )
const level = require( 'levelup' )
const pify = require( 'pify' )

// manually pify, only a few and simpler when some should not be promisified
const Db = db => ({
  get: pify( db.get ),
  put: pify( db.put ),
  del: pify( db.del ),
  createReadStream: db.createReadStream
})

/*
 in node a module is treated as a singleton
 we store a cache of the already open stores to prevent trying to open an
 already open store, as with some backing stores if it is already open it is
 locked and will throw an  error on trying to open it again
*/
const storeCache = {}

const Adapter = ( name, options ) => {
  if( name in storeCache ) return Promise.resolve( storeCache[ name ] )

  const opts = Object.assign( {}, defaults, options )
  const dbName = path.join( opts.path, name )
  const db = Db( level( dbName ) )

  const api = {
    exists: id => exists( db, id ),
    save: obj => save( db, obj ),
    load: id => load( db, id ),
    get: key => get( db, key ),
    remove: id => remove( db, id ),
    all: () => all( db )
  }

  storeCache[ name ] = api

  // some adapters will need async, this doesn't but has to be consistent
  return Promise.resolve( api )
}

const defaults = {
  path: './data/level'
}

const exists = ( db, id ) => new Promise( resolve =>
  load( db, id )
    .then( () => resolve( true ) )
    .catch( () => resolve( false ) )
)

const save = ( db, obj ) =>
  db.put( obj.value._id, JSON.stringify( obj ) )

const load = ( db, id ) => Array.isArray( id ) ?
  Promise.all( id.map( id => load( db, id ) ) ) :
  db.get( id )

const get = ( db, key ) => new Promise( ( resolve, reject ) => {
  const items = []

  const stream = key ?
    db.createReadStream({ start: key + '-' , end: key + '-\uffff' }) :
    db.createReadStream()

  stream
    .on( 'data', item => items.push( JSON.parse( item.value ) ) )
    .on( 'error', reject )
    .on( 'close', () => resolve( items ) )
})

const remove = ( db, id ) => db.del( id )

const all = db => get( db )

module.exports = Adapter
