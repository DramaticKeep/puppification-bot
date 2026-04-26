import { expect } from 'chai';
import { ChannelExemptionStore } from '../src/state/channelExemptions.ts';

describe('ChannelExemptionStore', () => {
  it('starts empty and reports nothing as exempt', () => {
    const s = new ChannelExemptionStore();
    expect(s.is('g', 'c', null)).to.equal(false);
    expect(s.list('g')).to.deep.equal([]);
  });

  it('exempts a channel and reports it as exempt', () => {
    const s = new ChannelExemptionStore();
    expect(s.exempt('g1', 'c1')).to.equal(true);
    expect(s.is('g1', 'c1', null)).to.equal(true);
    expect(s.list('g1')).to.deep.equal(['c1']);
  });

  it('returns false when exempting an already-exempt channel', () => {
    const s = new ChannelExemptionStore();
    s.exempt('g1', 'c1');
    expect(s.exempt('g1', 'c1')).to.equal(false);
    expect(s.list('g1')).to.deep.equal(['c1']);
  });

  it('scopes exemptions per guild', () => {
    const s = new ChannelExemptionStore();
    s.exempt('g1', 'c1');
    expect(s.is('g1', 'c1', null)).to.equal(true);
    expect(s.is('g2', 'c1', null)).to.equal(false);
  });

  it('treats threads under an exempt parent as exempt', () => {
    const s = new ChannelExemptionStore();
    s.exempt('g1', 'parent-1');
    expect(s.is('g1', 'thread-1', 'parent-1')).to.equal(true);
    expect(s.is('g1', 'thread-1', null)).to.equal(false);
    expect(s.is('g1', 'thread-1', 'other-parent')).to.equal(false);
  });

  it('unexempts and forgets the channel', () => {
    const s = new ChannelExemptionStore();
    s.exempt('g1', 'c1');
    expect(s.unexempt('g1', 'c1')).to.equal(true);
    expect(s.is('g1', 'c1', null)).to.equal(false);
    expect(s.list('g1')).to.deep.equal([]);
  });

  it('returns false when unexempting a non-exempt channel', () => {
    const s = new ChannelExemptionStore();
    expect(s.unexempt('g1', 'c1')).to.equal(false);
    s.exempt('g1', 'c1');
    s.unexempt('g1', 'c1');
    expect(s.unexempt('g1', 'c1')).to.equal(false);
  });

  it('clear() removes everything', () => {
    const s = new ChannelExemptionStore();
    s.exempt('g1', 'c1');
    s.exempt('g1', 'c2');
    s.exempt('g2', 'c3');
    s.clear();
    expect(s.is('g1', 'c1', null)).to.equal(false);
    expect(s.is('g1', 'c2', null)).to.equal(false);
    expect(s.is('g2', 'c3', null)).to.equal(false);
    expect(s.list('g1')).to.deep.equal([]);
    expect(s.list('g2')).to.deep.equal([]);
  });
});
