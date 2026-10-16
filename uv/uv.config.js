self.__uv$config = {
    prefix: 'service/',
    bare: 'https://is-a.dev', 
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: 'uv/uv.handler.js',
    bundle: 'uv/uv.bundle.js',
    config: 'uv/uv.config.js',
    sw: 'uv.sw.js', // Updated from 'uv/uv.sw.js'
};
