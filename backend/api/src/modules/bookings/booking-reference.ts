import { randomInt } from 'node:crypto';

// Without 0/O and 1/I, so a reference read aloud over the phone or copied by hand stays correct.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const LENGTH = 6;

/** A short booking code such as "GH7K3P9Q": "GH" plus 6 characters (32^6, about 10^9 codes). */
export function generateBookingReference(): string {
  let code = 'GH';
  for (let index = 0; index < LENGTH; index += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
