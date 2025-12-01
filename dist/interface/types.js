"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MODEL_CONFIG = exports.ID_COLUMN = exports.VirtualColumnUITypes = exports.SystemColumnUITypes = exports.SystemColumnNames = exports.ViewTypes = exports.RelationTypes = exports.UITypes = void 0;
// ========================================
// Column Types
// ========================================
/**
 * UI Type enum for column display types
 */
var UITypes;
(function (UITypes) {
    UITypes["ID"] = "ID";
    UITypes["SingleLineText"] = "SingleLineText";
    UITypes["LongText"] = "LongText";
    UITypes["Number"] = "Number";
    UITypes["Decimal"] = "Decimal";
    UITypes["Currency"] = "Currency";
    UITypes["Percent"] = "Percent";
    UITypes["Rating"] = "Rating";
    UITypes["Checkbox"] = "Checkbox";
    UITypes["Date"] = "Date";
    UITypes["DateTime"] = "DateTime";
    UITypes["Time"] = "Time";
    UITypes["Duration"] = "Duration";
    UITypes["Email"] = "Email";
    UITypes["PhoneNumber"] = "PhoneNumber";
    UITypes["URL"] = "URL";
    UITypes["SingleSelect"] = "SingleSelect";
    UITypes["MultiSelect"] = "MultiSelect";
    UITypes["Attachment"] = "Attachment";
    UITypes["JSON"] = "JSON";
    UITypes["Formula"] = "Formula";
    UITypes["Rollup"] = "Rollup";
    UITypes["Lookup"] = "Lookup";
    UITypes["LinkToAnotherRecord"] = "LinkToAnotherRecord";
    UITypes["Links"] = "Links";
    UITypes["User"] = "User";
    UITypes["CreatedBy"] = "CreatedBy";
    UITypes["LastModifiedBy"] = "LastModifiedBy";
    UITypes["CreatedTime"] = "CreatedTime";
    UITypes["LastModifiedTime"] = "LastModifiedTime";
    UITypes["AutoNumber"] = "AutoNumber";
    UITypes["Barcode"] = "Barcode";
    UITypes["QrCode"] = "QrCode";
    UITypes["GeoData"] = "GeoData";
    UITypes["Geometry"] = "Geometry";
    UITypes["SpecificDBType"] = "SpecificDBType";
})(UITypes || (exports.UITypes = UITypes = {}));
/**
 * Relation types for linked records
 */
var RelationTypes;
(function (RelationTypes) {
    RelationTypes["HAS_MANY"] = "hm";
    RelationTypes["BELONGS_TO"] = "bt";
    RelationTypes["MANY_TO_MANY"] = "mm";
})(RelationTypes || (exports.RelationTypes = RelationTypes = {}));
/**
 * View types
 */
var ViewTypes;
(function (ViewTypes) {
    ViewTypes["GRID"] = "grid";
    ViewTypes["FORM"] = "form";
    ViewTypes["GALLERY"] = "gallery";
    ViewTypes["KANBAN"] = "kanban";
    ViewTypes["CALENDAR"] = "calendar";
})(ViewTypes || (exports.ViewTypes = ViewTypes = {}));
// ========================================
// System Column Names
// ========================================
/**
 * System column name mapping
 */
exports.SystemColumnNames = {
    [UITypes.ID]: 'id',
    [UITypes.CreatedTime]: 'created_at',
    [UITypes.LastModifiedTime]: 'updated_at',
    [UITypes.CreatedBy]: 'created_by',
    [UITypes.LastModifiedBy]: 'updated_by',
    [UITypes.SingleLineText]: null,
    [UITypes.LongText]: null,
    [UITypes.Number]: null,
    [UITypes.Decimal]: null,
    [UITypes.Currency]: null,
    [UITypes.Percent]: null,
    [UITypes.Rating]: null,
    [UITypes.Checkbox]: null,
    [UITypes.Date]: null,
    [UITypes.DateTime]: null,
    [UITypes.Time]: null,
    [UITypes.Duration]: null,
    [UITypes.Email]: null,
    [UITypes.PhoneNumber]: null,
    [UITypes.URL]: null,
    [UITypes.SingleSelect]: null,
    [UITypes.MultiSelect]: null,
    [UITypes.Attachment]: null,
    [UITypes.JSON]: null,
    [UITypes.Formula]: null,
    [UITypes.Rollup]: null,
    [UITypes.Lookup]: null,
    [UITypes.LinkToAnotherRecord]: null,
    [UITypes.Links]: null,
    [UITypes.User]: null,
    [UITypes.AutoNumber]: null,
    [UITypes.Barcode]: null,
    [UITypes.QrCode]: null,
    [UITypes.GeoData]: null,
    [UITypes.Geometry]: null,
    [UITypes.SpecificDBType]: null,
};
/**
 * System column UI types
 */
exports.SystemColumnUITypes = [
    UITypes.ID,
    UITypes.CreatedTime,
    UITypes.LastModifiedTime,
    UITypes.CreatedBy,
    UITypes.LastModifiedBy,
];
/**
 * Virtual column UI types (computed, not stored directly)
 */
exports.VirtualColumnUITypes = [
    UITypes.Formula,
    UITypes.Rollup,
    UITypes.Lookup,
    UITypes.LinkToAnotherRecord,
    UITypes.Links,
];
/**
 * Default ID column definition
 */
exports.ID_COLUMN = {
    id: '__nc_id__',
    title: 'Id',
    column_name: 'id',
    uidt: UITypes.ID,
    pk: true,
    system: true,
};
/**
 * Default model configuration
 */
exports.DEFAULT_MODEL_CONFIG = {
    limitDefault: 25,
    limitMin: 1,
    limitMax: 1000,
};
//# sourceMappingURL=types.js.map