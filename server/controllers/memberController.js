const MemberProfile = require('../models/MemberProfile');
const User = require('../models/User');

const memberEditableFields = [
  'fullName',
  'dateOfBirth',
  'gender',
  'mobileNumber',
  'address',
  'emergencyContactName',
  'emergencyContactPhone',
  'height',
  'weight',
  'fitnessGoal',
  'exerciseExperience',
  'previousDiseases',
  'recentOperations',
  'healthNotes',
  'physicalLimitations',
];

// @desc    Get all members
// @route   GET /api/members
// @access  Private (Admin, Reception)
exports.getMembers = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
    const query = {};
    if (req.query.search) {
      const search = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { memberId: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } },
      ];
    }
    if (req.query.status) {
      query.registrationStatus = req.query.status;
    }

    if (req.query.search) {
      const email = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const accounts = await User.find({ email: { $regex: email, $options: 'i' } }).select('_id');
      query.$or.push({ user: { $in: accounts.map(account => account._id) } });
    }
    let membersQuery = MemberProfile.find(query);
    if (req.user.role === 'reception') {
      membersQuery = membersQuery.select(
        '-previousDiseases -recentOperations -healthNotes -physicalLimitations'
      );
    }
    const [members, total] = await Promise.all([
      membersQuery.populate('user', 'email role isActive')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      MemberProfile.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        members,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single member
// @route   GET /api/members/:id
// @access  Private
exports.getMember = async (req, res, next) => {
  try {
    const member = await MemberProfile.findById(req.params.id)
      .populate('user', 'email role isActive');

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }

    const memberData = member.toObject();
    if (['trainer', 'reception'].includes(req.user.role)) {
      delete memberData.previousDiseases;
      delete memberData.recentOperations;
      delete memberData.healthNotes;
      delete memberData.physicalLimitations;
    }

    res.status(200).json({
      success: true,
      data: memberData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new member
// @route   POST /api/members
// @access  Private (Admin, Reception)
exports.createMember = async (req, res, next) => {
  return res.status(410).json({
    success: false,
    error: 'Direct member profile creation is disabled. Use the validated member registration workflow.',
  });
};

exports.getMemberProfile = async (req, res, next) => {
  try {
    const member = await MemberProfile.findOne({ user: req.user.id });
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member profile not found' });
    }
    res.status(200).json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
};

exports.updateMemberProfile = async (req, res, next) => {
  try {
    const member = await MemberProfile.findOne({ user: req.user.id });
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member profile not found' });
    }
    for (const field of memberEditableFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        member[field] = req.body[field];
      }
    }
    await member.save();
    res.status(200).json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
};

// @desc    Update member
// @route   PUT /api/members/:id
// @access  Private
exports.updateMember = async (req, res, next) => {
  try {
    const member = await MemberProfile.findById(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }

    for (const field of memberEditableFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        member[field] = req.body[field];
      }
    }
    await member.save();

    res.status(200).json({
      success: true,
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete member
// @route   DELETE /api/members/:id
// @access  Private (Admin)
exports.deleteMember = async (req, res, next) => {
  try {
    const member = await MemberProfile.findById(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }

    member.registrationStatus = 'suspended';
    await member.save();
    await User.updateOne({ _id: member.user }, {
      $set: { isActive: false },
      $unset: { refreshTokenHash: 1 },
    });

    res.status(200).json({
      success: true,
      data: { memberId: member.memberId, registrationStatus: member.registrationStatus },
    });
  } catch (error) {
    next(error);
  }
};
