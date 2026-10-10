const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const supplierRules = require("../validation/supplierRules");
const suppliers = require("../controllers/supplierController");
const purchaseOrders = require("../controllers/purchaseOrderController");
const inventory = require("../controllers/inventoryController");

const read = requirePermission("inventory.view");

const supplierRouter = express.Router();
supplierRouter.use(protect);
supplierRouter.get("/", read, suppliers.getSuppliers);
supplierRouter.post("/", requirePermission("suppliers.write"), validate(supplierRules), suppliers.createSupplier);
supplierRouter.put("/:id", requirePermission("suppliers.write"), validate(supplierRules), suppliers.updateSupplier);
supplierRouter.delete("/:id", requirePermission("suppliers.delete"), suppliers.deleteSupplier);

const purchaseOrderRouter = express.Router();
purchaseOrderRouter.use(protect);
purchaseOrderRouter.get("/", read, purchaseOrders.listPurchaseOrders);
purchaseOrderRouter.get("/:id", read, purchaseOrders.getPurchaseOrder);
purchaseOrderRouter.post("/", requirePermission("purchasing.write"), purchaseOrders.createPurchaseOrder);
purchaseOrderRouter.put("/:id", requirePermission("purchasing.write"), purchaseOrders.updatePurchaseOrder);
purchaseOrderRouter.delete("/:id", requirePermission("purchasing.write"), purchaseOrders.deletePurchaseOrder);
purchaseOrderRouter.post("/:id/order", requirePermission("purchasing.write"), purchaseOrders.placePurchaseOrder);
purchaseOrderRouter.post("/:id/receive", requirePermission("purchasing.receive"), purchaseOrders.receivePurchaseOrder);
purchaseOrderRouter.post("/:id/cancel", requirePermission("purchasing.write"), purchaseOrders.cancelPurchaseOrder);

const inventoryRouter = express.Router();
inventoryRouter.use(protect);
inventoryRouter.get("/summary", read, inventory.getSummary);
inventoryRouter.get("/movements", read, inventory.getMovements);
inventoryRouter.get("/reorder-suggestions", read, inventory.getReorderSuggestions);
inventoryRouter.post("/reorder-suggestions/purchase-orders", requirePermission("purchasing.write"), inventory.createDraftsFromSuggestions);

module.exports = { inventoryRouter, purchaseOrderRouter, supplierRouter };
