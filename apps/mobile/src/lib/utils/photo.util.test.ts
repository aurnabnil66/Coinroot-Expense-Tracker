import { describe, expect, it } from '@jest/globals';

import { formatFileSize, MAX_PHOTO_BYTES, MIN_PHOTO_SIDE, pickedPhotoProblem, savedPhotoProblem, squareCrop } from './photo.util';

const MB = 1024 * 1024;

describe('pickedPhotoProblem', () => {
  it('accepts a normal phone photo, even a big one', () => {
    expect(pickedPhotoProblem({ type: 'image', mimeType: 'image/jpeg', fileSize: 8 * MB, width: 4000, height: 3000 })).toBeNull();
    expect(pickedPhotoProblem({ type: 'image', mimeType: 'image/HEIC', fileSize: 2 * MB, width: 3024, height: 4032 })).toBeNull();
  });

  it('accepts a photo whose details the picker left out', () => {
    expect(pickedPhotoProblem({ type: 'image', mimeType: null, fileSize: undefined, width: 0, height: 0 })).toBeNull();
  });

  it('refuses videos and files that are not supported photos', () => {
    const message = 'Choose a photo (JPG, PNG, WebP or HEIC).';
    expect(pickedPhotoProblem({ type: 'video', mimeType: 'video/mp4' })).toBe(message);
    expect(pickedPhotoProblem({ type: 'image', mimeType: 'image/gif' })).toBe(message);
    expect(pickedPhotoProblem({ mimeType: 'application/pdf' })).toBe(message);
  });

  it('refuses originals over 25 MB, saying how big they are', () => {
    expect(pickedPhotoProblem({ type: 'image', mimeType: 'image/png', fileSize: 30 * MB })).toBe(
      'This photo is too large (30 MB). Choose one under 25 MB.'
    );
    expect(pickedPhotoProblem({ type: 'image', fileSize: 25 * MB })).toBeNull();
  });

  it(`refuses photos smaller than ${MIN_PHOTO_SIDE} pixels on a side`, () => {
    expect(pickedPhotoProblem({ type: 'image', width: 100, height: 400 })).toBe(
      'This photo is too small (100 × 400). Choose one at least 128 × 128 pixels.'
    );
    expect(pickedPhotoProblem({ type: 'image', width: 128, height: 128 })).toBeNull();
  });
});

describe('squareCrop', () => {
  it('takes the centred square and shrinks it to 512', () => {
    expect(squareCrop(4000, 3000)).toEqual({ originX: 500, originY: 0, side: 3000, target: 512 });
    expect(squareCrop(3024, 4032)).toEqual({ originX: 0, originY: 504, side: 3024, target: 512 });
  });

  it("doesn't enlarge a small photo", () => {
    expect(squareCrop(300, 300)).toEqual({ originX: 0, originY: 0, side: 300, target: 300 });
  });
});

describe('savedPhotoProblem', () => {
  it('accepts a shrunk photo up to 1 MB', () => {
    expect(savedPhotoProblem(60 * 1024)).toBeNull();
    expect(savedPhotoProblem(MAX_PHOTO_BYTES)).toBeNull();
  });

  it('refuses an empty or too-large result', () => {
    expect(savedPhotoProblem(0)).toMatch(/couldn't be read/);
    expect(savedPhotoProblem(MAX_PHOTO_BYTES + 1)).toMatch(/small enough/);
  });
});

describe('formatFileSize', () => {
  it('shows MB or KB', () => {
    expect(formatFileSize(3.4 * MB)).toBe('3.4 MB');
    expect(formatFileSize(30 * MB)).toBe('30 MB');
    expect(formatFileSize(820 * 1024)).toBe('820 KB');
    expect(formatFileSize(10)).toBe('1 KB');
  });
});
