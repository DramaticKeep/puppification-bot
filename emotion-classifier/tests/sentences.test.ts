import { expect } from 'chai';
import { splitSentences } from '../src/sentences.ts';

describe('splitSentences', () => {
  it('returns an empty array for empty input', () => {
    expect(splitSentences('')).to.deep.equal([]);
  });

  it('returns an empty array for whitespace-only input', () => {
    expect(splitSentences('   \n\t  ')).to.deep.equal([]);
  });

  it('returns the input unchanged when there is no terminator', () => {
    expect(splitSentences('hello world')).to.deep.equal(['hello world']);
  });

  it('splits the spec example into two sentences', () => {
    expect(splitSentences('I am ecstatic! I got a promotion.')).to.deep.equal([
      'I am ecstatic!',
      'I got a promotion.',
    ]);
  });

  it('splits on . ! and ? terminators', () => {
    expect(
      splitSentences('First. Second! Third? Fourth.'),
    ).to.deep.equal(['First.', 'Second!', 'Third?', 'Fourth.']);
  });

  it('preserves common abbreviations like Mr.', () => {
    expect(splitSentences('Mr. Smith went home.')).to.deep.equal([
      'Mr. Smith went home.',
    ]);
  });

  it('preserves multiple abbreviations in one sentence', () => {
    expect(
      splitSentences('Dr. Watson and Mrs. Hudson chatted. Then they left.'),
    ).to.deep.equal([
      'Dr. Watson and Mrs. Hudson chatted.',
      'Then they left.',
    ]);
  });

  it('preserves decimal numbers', () => {
    expect(splitSentences('Pi is 3.14 exactly.')).to.deep.equal([
      'Pi is 3.14 exactly.',
    ]);
  });

  it('preserves multi-letter abbreviations with internal periods', () => {
    expect(
      splitSentences('Cats are great, e.g. Tabbies are fluffy.'),
    ).to.deep.equal(['Cats are great, e.g. Tabbies are fluffy.']);
  });

  it('does not split mid-ellipsis when followed by a lowercase word', () => {
    expect(splitSentences('Wait... what?')).to.deep.equal(['Wait... what?']);
  });

  it('does split on an ellipsis followed by an uppercase sentence', () => {
    expect(splitSentences('Wait... What now?')).to.deep.equal([
      'Wait...',
      'What now?',
    ]);
  });

  it('treats trailing closing quotes as part of the same sentence', () => {
    expect(splitSentences('She said "hi!" and left.')).to.deep.equal([
      'She said "hi!" and left.',
    ]);
  });

  it('splits when a quote-terminated sentence is followed by a new sentence', () => {
    expect(
      splitSentences('She said "hi!" Then she left.'),
    ).to.deep.equal(['She said "hi!"', 'Then she left.']);
  });

  it('handles a single-sentence phrase with a trailing period', () => {
    expect(splitSentences('Hello world.')).to.deep.equal(['Hello world.']);
  });

  it('drops empty fragments produced by extra whitespace', () => {
    expect(splitSentences('  Hi.   There.   ')).to.deep.equal([
      'Hi.',
      'There.',
    ]);
  });
});
