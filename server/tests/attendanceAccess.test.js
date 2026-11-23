const test = require('node:test');
const assert = require('node:assert/strict');
const MemberMembership = require('../models/MemberMembership');
const MemberProfile = require('../models/MemberProfile');
const GymOperatingHours = require('../models/GymOperatingHours');
const SystemSetting = require('../models/SystemSetting');
const { validateAttendanceAccess } = require('../services/attendanceAccess');

test('validateAttendanceAccess allows active member with valid future dates even if profile status is out of sync', async () => {
  const memberId = '507f1f77bcf86cd799439011';
  const member = {
    _id: memberId,
    memberId: 'GYM1087',
    fullName: 'Sanjay Shetty',
    registrationStatus: 'pending_payment', // stale profile status
    membershipStatus: 'none',             // stale profile status
  };
  const now = new Date('2026-11-23T12:00:00Z');

  // Mock MemberMembership.findOne
  const originalMembershipFindOne = MemberMembership.findOne;
  const originalProfileUpdateOne = MemberProfile.updateOne;
  const originalGymHoursFindOne = GymOperatingHours.findOne;
  const originalSystemSettingFindOne = SystemSetting.findOne;

  try {
    MemberMembership.findOne = (query) => {
      return {
        populate: () => ({
          sort: () => ({
            session: async () => ({
              _id: 'mem123',
              member: memberId,
              membershipPlan: { name: 'Premium' },
              startDate: new Date('2026-11-09T00:00:00Z'),
              endDate: new Date('2027-05-09T23:59:59Z'),
              status: 'active',
              paymentStatus: 'paid',
            }),
          }),
        }),
        sort: () => ({
          session: async () => ({
            _id: 'mem123',
            member: memberId,
            membershipPlan: { name: 'Premium' },
            startDate: new Date('2026-11-09T00:00:00Z'),
            endDate: new Date('2027-05-09T23:59:59Z'),
            status: 'active',
            paymentStatus: 'paid',
          }),
        }),
      };
    };

    let updatedFields = null;
    MemberProfile.updateOne = async (query, update) => {
      updatedFields = update.$set;
      return { acknowledged: true };
    };

    GymOperatingHours.findOne = () => ({
      session: async () => ({
        isOpen: true,
        openTime: '00:00',
        closeTime: '23:59',
        sessions: [],
      }),
    });

    SystemSetting.findOne = () => ({
      session: async () => ({ value: false }),
    });

    const result = await validateAttendanceAccess(member, now);
    assert.ok(result.membership, 'Should return membership');
    assert.equal(result.membership.status, 'active');
    assert.equal(updatedFields?.membershipStatus, 'active', 'Profile status auto-healed');
    assert.equal(updatedFields?.registrationStatus, 'active', 'Registration status auto-healed');
  } finally {
    MemberMembership.findOne = originalMembershipFindOne;
    MemberProfile.updateOne = originalProfileUpdateOne;
    GymOperatingHours.findOne = originalGymHoursFindOne;
    SystemSetting.findOne = originalSystemSettingFindOne;
  }
});

test('validateAttendanceAccess throws expired error with isExpired=true when membership endDate is in the past', async () => {
  const memberId = '507f1f77bcf86cd799439012';
  const member = {
    _id: memberId,
    memberId: 'GYM1088',
    fullName: 'Expired Member',
    registrationStatus: 'active',
    membershipStatus: 'expired',
  };
  const now = new Date('2026-11-23T12:00:00Z');

  const originalMembershipFindOne = MemberMembership.findOne;
  try {
    MemberMembership.findOne = (query) => {
      if (query.endDate) {
        // Range queries for active membership (endDate >= now) return null for expired
        return {
          populate: () => ({
            sort: () => ({
              session: async () => null,
            }),
          }),
          sort: () => ({
            session: async () => null,
          }),
        };
      }
      // latestMembership query has no endDate filter
      return {
        populate: () => ({
          sort: () => ({
            session: async () => ({
              _id: 'mem_old',
              member: memberId,
              membershipPlan: { name: 'Basic' },
              startDate: new Date('2026-05-01T00:00:00Z'),
              endDate: new Date('2026-11-01T23:59:59Z'), // expired 22 days ago
              status: 'expired',
              paymentStatus: 'paid',
            }),
          }),
        }),
        sort: () => ({
          session: async () => null,
        }),
      };
    };

    await assert.rejects(
      async () => validateAttendanceAccess(member, now),
      (err) => {
        assert.equal(err.code, 'MEMBERSHIP_INELIGIBLE');
        assert.equal(err.isExpired, true);
        assert.ok(err.message.includes('expired on'));
        assert.ok(err.membership);
        return true;
      }
    );
  } finally {
    MemberMembership.findOne = originalMembershipFindOne;
  }
});

test('validateAttendanceAccess blocks suspended account with ACCOUNT_INACTIVE', async () => {
  const memberId = '507f1f77bcf86cd799439013';
  const member = {
    _id: memberId,
    memberId: 'GYM1089',
    fullName: 'Suspended Member',
    registrationStatus: 'suspended',
    membershipStatus: 'active',
  };
  const now = new Date('2026-11-23T12:00:00Z');

  const originalMembershipFindOne = MemberMembership.findOne;
  try {
    MemberMembership.findOne = () => ({
      populate: () => ({
        sort: () => ({
          session: async () => null,
        }),
      }),
      sort: () => ({
        session: async () => null,
      }),
    });

    await assert.rejects(
      async () => validateAttendanceAccess(member, now),
      (err) => {
        assert.equal(err.code, 'ACCOUNT_INACTIVE');
        assert.equal(err.isExpired, false);
        return true;
      }
    );
  } finally {
    MemberMembership.findOne = originalMembershipFindOne;
  }
});

test('validateAttendanceAccess auto-unfreezes a frozen paid membership with valid future dates upon check-in', async () => {
  const memberId = '507f1f77bcf86cd799439014';
  const member = {
    _id: memberId,
    memberId: 'GYM1087',
    fullName: 'Sanjay Shetty',
    registrationStatus: 'active',
    membershipStatus: 'frozen',
  };
  const now = new Date('2026-11-23T12:00:00Z');

  const originalMembershipFindOne = MemberMembership.findOne;
  const originalMembershipUpdateOne = MemberMembership.updateOne;
  const originalProfileUpdateOne = MemberProfile.updateOne;
  const originalGymHoursFindOne = GymOperatingHours.findOne;
  const originalSystemSettingFindOne = SystemSetting.findOne;

  try {
    const mockMembership = {
      _id: 'mem_frozen',
      member: memberId,
      membershipPlan: { name: 'Premium' },
      startDate: new Date('2026-11-09T00:00:00Z'),
      endDate: new Date('2027-05-09T23:59:59Z'),
      status: 'frozen',
      paymentStatus: 'paid',
      frozenAt: new Date('2026-11-20T00:00:00Z'),
      populate: function() { return this; },
    };

    let updatedMembershipFields = null;
    MemberMembership.updateOne = async (query, update) => {
      updatedMembershipFields = update.$set;
      return { acknowledged: true };
    };

    MemberMembership.findOne = (query) => {
      if (query.status === 'active') {
        // getCurrentMembership checks status: 'active', so returns null when frozen
        return {
          populate: () => ({
            sort: () => ({
              session: async () => null,
            }),
          }),
          sort: () => ({
            session: async () => null,
          }),
        };
      }
      // fallback findOne where status: { $ne: 'cancelled' }
      return {
        populate: () => ({
          sort: () => ({
            session: async () => mockMembership,
          }),
        }),
        sort: () => ({
          session: async () => mockMembership,
        }),
      };
    };

    let updatedProfileFields = null;
    MemberProfile.updateOne = async (query, update) => {
      updatedProfileFields = update.$set;
      return { acknowledged: true };
    };

    GymOperatingHours.findOne = () => ({
      session: async () => ({
        isOpen: true,
        openTime: '00:00',
        closeTime: '23:59',
        sessions: [],
      }),
    });

    SystemSetting.findOne = () => ({
      session: async () => ({ value: false }),
    });

    const result = await validateAttendanceAccess(member, now);
    assert.ok(result.membership, 'Should return membership');
    assert.equal(updatedMembershipFields?.status, 'active', 'Membership status should be auto-unfrozen to active via updateOne');
    assert.equal(result.membership.status, 'active');
    assert.equal(updatedProfileFields?.membershipStatus, 'active', 'Profile status auto-healed to active');
  } finally {
    MemberMembership.findOne = originalMembershipFindOne;
    MemberMembership.updateOne = originalMembershipUpdateOne;
    MemberProfile.updateOne = originalProfileUpdateOne;
    GymOperatingHours.findOne = originalGymHoursFindOne;
    SystemSetting.findOne = originalSystemSettingFindOne;
  }
});

test('validateAttendanceAccess accepts check-in during gym closed hours and marks isSpecialHours=true', async () => {
  const memberId = '507f1f77bcf86cd799439099';
  const member = {
    _id: memberId,
    memberId: 'GYM1099',
    fullName: 'Special Hours Member',
    registrationStatus: 'active',
    membershipStatus: 'active',
  };
  const now = new Date('2026-11-23T13:30:00Z');

  const originalMembershipFindOne = MemberMembership.findOne;
  const originalProfileUpdateOne = MemberProfile.updateOne;
  const originalGymHoursFindOne = GymOperatingHours.findOne;
  const originalSystemSettingFindOne = SystemSetting.findOne;

  try {
    MemberMembership.findOne = () => ({
      populate: () => ({
        sort: () => ({
          session: async () => ({
            _id: 'mem_special',
            member: memberId,
            membershipPlan: { name: 'Premium' },
            startDate: new Date('2026-11-09T00:00:00Z'),
            endDate: new Date('2027-05-09T23:59:59Z'),
            status: 'active',
            paymentStatus: 'paid',
          }),
        }),
      }),
      sort: () => ({
        session: async () => ({
          _id: 'mem_special',
          member: memberId,
          membershipPlan: { name: 'Premium' },
          startDate: new Date('2026-11-09T00:00:00Z'),
          endDate: new Date('2027-05-09T23:59:59Z'),
          status: 'active',
          paymentStatus: 'paid',
        }),
      }),
    });

    // Mock Gym is closed today or in afternoon break
    GymOperatingHours.findOne = () => ({
      session: async () => ({
        isOpen: false, // Closed!
        openTime: '06:00',
        closeTime: '21:00',
        sessions: [],
      }),
    });

    SystemSetting.findOne = () => ({
      session: async () => ({ value: false }),
    });

    // Should NOT throw 'The gym is currently closed'
    const result = await validateAttendanceAccess(member, now);
    assert.ok(result.membership, 'Should return membership');
    assert.equal(result.isSpecialHours, true, 'isSpecialHours should be true when gym is closed');
  } finally {
    MemberMembership.findOne = originalMembershipFindOne;
    MemberProfile.updateOne = originalProfileUpdateOne;
    GymOperatingHours.findOne = originalGymHoursFindOne;
    SystemSetting.findOne = originalSystemSettingFindOne;
  }
});

test('validateAttendanceAccess allows active member with valid future dates even if paymentStatus is pending, auto-healing to paid', async () => {
  const memberId = '507f1f77bcf86cd799439167';
  const member = {
    _id: memberId,
    memberId: 'GYM1671',
    fullName: 'Kiran Das',
    registrationStatus: 'active',
    membershipStatus: 'active',
  };
  const now = new Date('2026-11-23T15:53:00Z');

  const originalMembershipFindOne = MemberMembership.findOne;
  const originalMembershipUpdateOne = MemberMembership.updateOne;
  const originalProfileUpdateOne = MemberProfile.updateOne;
  const originalGymHoursFindOne = GymOperatingHours.findOne;
  const originalSystemSettingFindOne = SystemSetting.findOne;

  try {
    let updatedMembership = null;
    MemberMembership.updateOne = async (query, update) => {
      updatedMembership = update.$set;
      return { acknowledged: true };
    };

    MemberMembership.findOne = () => ({
      populate: () => ({
        sort: () => ({
          session: async () => ({
            _id: 'mem_kiran',
            member: memberId,
            membershipPlan: { name: 'Standard' },
            startDate: new Date('2026-11-09T00:00:00Z'),
            endDate: new Date('2027-02-09T23:59:59Z'),
            status: 'active',
            paymentStatus: 'pending', // Pending payment!
            totalAmount: 5000,
            amountPaid: 0,
            pendingAmount: 5000,
          }),
        }),
      }),
      sort: () => ({
        session: async () => ({
          _id: 'mem_kiran',
          member: memberId,
          membershipPlan: { name: 'Standard' },
          startDate: new Date('2026-11-09T00:00:00Z'),
          endDate: new Date('2027-02-09T23:59:59Z'),
          status: 'active',
          paymentStatus: 'pending',
          totalAmount: 5000,
          amountPaid: 0,
          pendingAmount: 5000,
        }),
      }),
    });

    GymOperatingHours.findOne = () => ({
      session: async () => ({
        isOpen: true,
        openTime: '00:00',
        closeTime: '23:59',
        sessions: [],
      }),
    });

    SystemSetting.findOne = () => ({
      session: async () => ({ value: false }),
    });

    // Should NOT throw 'Membership payment is pending'
    const result = await validateAttendanceAccess(member, now);
    assert.ok(result.membership, 'Should return membership');
    assert.equal(result.membership.status, 'active');
    assert.equal(result.membership.paymentStatus, 'paid', 'Payment status should be auto-healed to paid');
    assert.equal(updatedMembership?.paymentStatus, 'paid');
  } finally {
    MemberMembership.findOne = originalMembershipFindOne;
    MemberMembership.updateOne = originalMembershipUpdateOne;
    MemberProfile.updateOne = originalProfileUpdateOne;
    GymOperatingHours.findOne = originalGymHoursFindOne;
    SystemSetting.findOne = originalSystemSettingFindOne;
  }
});
