import templateModel from "../models/templateModel.js";
import themeModel from "../models/themeModel.js";
import userModel from "../models/userModel.js";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Template Management

// Get all templates
export const getAllTemplates = async (req, res) => {
  try {
    const { type, isActive, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const templates = await templateModel
      .find(filter)
      .populate("createdBy", "username name")
      .populate("updatedBy", "username name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await templateModel.countDocuments(filter);

    res.json({
      success: true,
      data: templates,
      pagination: {
        current: pageNum,
        total: Math.ceil(total / limitNum),
        count: templates.length,
        totalDocuments: total
      }
    });
  } catch (error) {
    logger.error("Get all templates error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Create new template
export const createTemplate = async (req, res) => {
  try {
    const userId = req.body.userId;
    const templateData = { ...req.body, createdBy: userId, updatedBy: userId };

    const template = new templateModel(templateData);
    await template.save();

    await template.populate("createdBy", "username name");

    logger.info(`Template created: ${template.name} by user ${userId}`);

    res.status(201).json({
      success: true,
      message: "Template created successfully",
      data: template
    });
  } catch (error) {
    logger.error("Create template error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Update template
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;
    const updates = { ...req.body, updatedBy: userId };

    const template = await templateModel.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate("createdBy", "username name").populate("updatedBy", "username name");

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    logger.info(`Template updated: ${template.name} by user ${userId}`);

    res.json({
      success: true,
      message: "Template updated successfully",
      data: template
    });
  } catch (error) {
    logger.error("Update template error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Delete template
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await templateModel.findByIdAndDelete(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    logger.info(`Template deleted: ${template.name}`);

    res.json({
      success: true,
      message: "Template deleted successfully"
    });
  } catch (error) {
    logger.error("Delete template error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Toggle template active status
export const toggleTemplateStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await templateModel.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    template.isActive = !template.isActive;
    await template.save();

    res.json({
      success: true,
      message: `Template ${template.isActive ? 'activated' : 'deactivated'} successfully`,
      data: template
    });
  } catch (error) {
    logger.error("Toggle template status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Theme Management

// Get all themes
export const getAllThemes = async (req, res) => {
  try {
    const { type, isActive, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const themes = await themeModel
      .find(filter)
      .populate("createdBy", "username name")
      .populate("updatedBy", "username name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await themeModel.countDocuments(filter);

    res.json({
      success: true,
      data: themes,
      pagination: {
        current: pageNum,
        total: Math.ceil(total / limitNum),
        count: themes.length,
        totalDocuments: total
      }
    });
  } catch (error) {
    logger.error("Get all themes error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Create new theme
export const createTheme = async (req, res) => {
  try {
    const userId = req.body.userId;
    const themeData = { ...req.body, createdBy: userId, updatedBy: userId };

    const theme = new themeModel(themeData);
    await theme.save();

    await theme.populate("createdBy", "username name");

    logger.info(`Theme created: ${theme.name} by user ${userId}`);

    res.status(201).json({
      success: true,
      message: "Theme created successfully",
      data: theme
    });
  } catch (error) {
    logger.error("Create theme error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Update theme
export const updateTheme = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;
    const updates = { ...req.body, updatedBy: userId };

    const theme = await themeModel.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate("createdBy", "username name").populate("updatedBy", "username name");

    if (!theme) {
      return res.status(404).json({
        success: false,
        message: "Theme not found"
      });
    }

    logger.info(`Theme updated: ${theme.name} by user ${userId}`);

    res.json({
      success: true,
      message: "Theme updated successfully",
      data: theme
    });
  } catch (error) {
    logger.error("Update theme error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Delete theme
export const deleteTheme = async (req, res) => {
  try {
    const { id } = req.params;

    const theme = await themeModel.findByIdAndDelete(id);

    if (!theme) {
      return res.status(404).json({
        success: false,
        message: "Theme not found"
      });
    }

    logger.info(`Theme deleted: ${theme.name}`);

    res.json({
      success: true,
      message: "Theme deleted successfully"
    });
  } catch (error) {
    logger.error("Delete theme error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Toggle theme active status
export const toggleThemeStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const theme = await themeModel.findById(id);
    if (!theme) {
      return res.status(404).json({
        success: false,
        message: "Theme not found"
      });
    }

    theme.isActive = !theme.isActive;
    await theme.save();

    res.json({
      success: true,
      message: `Theme ${theme.isActive ? 'activated' : 'deactivated'} successfully`,
      data: theme
    });
  } catch (error) {
    logger.error("Toggle theme status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Set default theme
export const setDefaultTheme = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    // Remove default from other themes of same type
    await themeModel.updateMany(
      { type, _id: { $ne: id } },
      { isDefault: false }
    );

    // Set this theme as default
    const theme = await themeModel.findByIdAndUpdate(
      id,
      { isDefault: true },
      { new: true }
    );

    if (!theme) {
      return res.status(404).json({
        success: false,
        message: "Theme not found"
      });
    }

    res.json({
      success: true,
      message: "Default theme set successfully",
      data: theme
    });
  } catch (error) {
    logger.error("Set default theme error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get current default theme
export const getDefaultTheme = async (req, res) => {
  try {
    const { type = 'website' } = req.query;

    const theme = await themeModel.findOne({ type, isDefault: true });

    res.json({
      success: true,
      data: theme
    });
  } catch (error) {
    logger.error("Get default theme error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Apply theme to catalog
export const applyThemeToCatalog = async (req, res) => {
  try {
    const { catalogId, themeId } = req.params;

    const theme = await themeModel.findById(themeId);
    if (!theme) {
      return res.status(404).json({
        success: false,
        message: "Theme not found"
      });
    }

    const catalog = await catalogModel.findById(catalogId);
    if (!catalog) {
      return res.status(404).json({
        success: false,
        message: "Catalog not found"
      });
    }

    // Apply theme settings to catalog
    const updates = {
      theme: theme.theme,
      design: {
        ...catalog.design,
        colorScheme: theme.colorScheme,
        typography: theme.typography,
        layout: theme.layout,
        customCSS: theme.customCSS
      },
      header: {
        ...catalog.header,
        backgroundColor: theme.header.backgroundColor,
        textColor: theme.header.textColor,
        height: theme.header.height
      },
      footer: {
        ...catalog.footer,
        backgroundColor: theme.footer.backgroundColor,
        textColor: theme.footer.textColor,
        linkColor: theme.footer.linkColor
      }
    };

    const updatedCatalog = await catalogModel.findByIdAndUpdate(
      catalogId,
      updates,
      { new: true }
    );

    res.json({
      success: true,
      message: "Theme applied to catalog successfully",
      data: updatedCatalog
    });
  } catch (error) {
    logger.error("Apply theme to catalog error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};