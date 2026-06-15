const Joi = require('joi');

const registerValidation = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().min(7).max(15).optional().allow(''),
    password: Joi.string().min(6).optional().allow(''),
    role: Joi.string().valid('donor', 'ngo', 'admin').default('donor'),
    address: Joi.string().min(2).max(300).optional().allow(''),
    // Geo coords optional — default [0,0] set in User model
    longitude: Joi.number().min(-180).max(180).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    // NGO specific — only required when role === 'ngo'
    ngoDetails: Joi.when('role', {
      is: 'ngo',
      then: Joi.object({
        registrationNumber: Joi.string().required(),
        description: Joi.string().min(10).required(),
        website: Joi.string().uri().optional(),
        establishedYear: Joi.number().min(1800).max(new Date().getFullYear()).optional(),
      }).required(),
      otherwise: Joi.optional(),
    }),
  });
  return schema.validate(data, { abortEarly: false });
};

const loginValidation = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  });
  return schema.validate(data);
};

const donationValidation = (data) => {
  const schema = Joi.object({
    category: Joi.string()
      .valid('food', 'clothes', 'money', 'electronics', 'books', 'medicines', 'blood', 'other')
      .required(),
    description: Joi.string().min(5).max(500).required(),
    quantity: Joi.string().min(1).max(100).required(),
    assignedNgoId: Joi.string().hex().length(24).optional(), // MongoDB ObjectId
  }).options({ allowUnknown: true }); // allow multer file fields
  return schema.validate(data);
};

const requirementValidation = (data) => {
  const schema = Joi.object({
    category: Joi.string()
      .valid('food', 'clothes', 'money', 'electronics', 'books', 'medicines', 'blood', 'other')
      .required(),
    description: Joi.string().min(5).max(500).required(),
    quantity: Joi.string().min(1).max(100).optional(),
    urgency: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    needByDate: Joi.date().iso().optional(),
  });
  return schema.validate(data);
};

module.exports = {
  registerValidation,
  loginValidation,
  donationValidation,
  requirementValidation,
};

