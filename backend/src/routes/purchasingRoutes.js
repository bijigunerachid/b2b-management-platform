const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const supplierRules = require("../validation/supplierRules");
const suppliers = require("../controllers/supplierController");
const purchaseOrders = require("../controllers/purchaseOrderController");
const inventory = require("../controllers/inventoryController");

const read = authorize("Admin", "Manager", "Employee");
const write = authorize("Admin", "Manager");

const supplierRouter = express.Router();
supplierRouter.use(protect);
supplierRouter.get("/", read, suppliers.getSuppliers);
supplierRouter.post("/", write, validate(supplierRules), suppliers.createSupplier);
supplierRouter.put("/:id", write, validate(supplierRules), suppliers.updateSupplier);
supplierRouter.delete("/:id", authorize("Admin"), suppliers.deleteSupplier);

const purchaseOrderRouter = express.Router();
purchaseOrderRouter.use(protect);
purchaseOrderRouter.get("/", read, purchaseOrders.listPurchaseOrders);
purchaseOrderRouter.get("/:id", read, purchaseOrders.getPurchaseOrder);
purchaseOrderRouter.post("/", write, purchaseOrders.createPurchaseOrder);
purchaseOrderRouter.put("/:id", write, purchaseOrders.updatePurchaseOrder);
purchaseOrderRouter.delete("/:id", write, purchaseOrders.deletePurchaseOrder);
purchaseOrderRouter.post("/:id/order", write, purchaseOrders.placePurchaseOrder);
purchaseOrderRouter.post("/:id/receive", write, purchaseOrders.receivePurchaseOrder);
purchaseOrderRouter.post("/:id/cancel", write, purchaseOrders.cancelPurchaseOrder);

const inventoryRouter = express.Router();
inventoryRouter.use(protect);
inventoryRouter.get("/summary", read, inventory.getSummary);
inventoryRouter.get("/movements", read, inventory.getMovements);
inventoryRouter.get("/reorder-suggestions", read, inventory.getReorderSuggestions);
inventoryRouter.post("/reorder-suggestions/purchase-orders", write, inventory.createDraftsFromSuggestions);

module.exports = { inventoryRouter, purchaseOrderRouter, supplierRouter };
