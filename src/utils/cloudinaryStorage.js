import { Transform, pipeline } from 'node:stream';

const imageSignature = (bytes, mime) => {
  if (mime === 'image/jpeg' || mime === 'image/jpg')
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png')
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/webp')
    return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
};

// Multer storage using the maintained SDK, with file-content validation before upload.
export class CloudinaryStorage {
  constructor({ cloudinary, params }) {
    this.cloudinary = cloudinary;
    this.params = params;
  }

  _handleFile(req, file, callback) {
    let settled = false;
    const done = (error, value) => {
      if (settled) return;
      settled = true;
      callback(error, value);
    };
    let prefix = Buffer.alloc(0);
    let checked = false;
    const check = new Transform({
      transform(chunk, encoding, next) {
        if (checked) return next(null, chunk);
        prefix = Buffer.concat([prefix, chunk]);
        if (prefix.length < 12) return next();
        checked = true;
        if (!imageSignature(prefix, file.mimetype))
          return next(new Error('The uploaded file content does not match its image type.'));
        next(null, prefix);
        prefix = null;
      },
      flush(next) {
        if (!checked) return next(new Error('The uploaded image is empty or invalid.'));
        next();
      },
    });
    try {
      const upload = this.cloudinary.uploader.upload_stream(
        { ...this.params, resource_type: 'image' },
        (error, result) => {
          if (error) return done(error);
          if (!result?.secure_url || !result?.public_id)
            return done(new Error('Image storage returned an invalid response.'));
          done(null, { path: result.secure_url, filename: result.public_id, size: result.bytes });
        },
      );
      pipeline(file.stream, check, upload, (error) => {
        if (error) done(error);
      });
    } catch (error) {
      done(error);
    }
  }

  _removeFile(req, file, callback) {
    this.cloudinary.uploader.destroy(file.filename, { resource_type: 'image' }, callback);
  }
}
