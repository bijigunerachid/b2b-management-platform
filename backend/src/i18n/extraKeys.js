// Texts the API sends that scripts/extract-messages.js can't find in the code:
// audit summaries (built from parts in audit/describe.js), values that appear
// inside messages, and price label parts. The i18n check requires a French and
// Arabic translation for each, like the extracted messages.

const { FIELD_LABELS } = require("../middleware/validate");

// Statuses that appear inside messages ("Order is already {status}").
const STATUSES = [
    "Pending", "Processing", "Completed", "Cancelled",
    "Draft", "Ordered", "Received", "Sent", "Accepted", "Rejected", "Expired", "Converted"
];

// Audit log summaries, as templates (see audit/describe.js).
const AUDIT_SUMMARIES = [
    "Signed in",
    "Signed out",
    "Changed their password",
    "Failed sign-in for {email}",
    "Created customer {name}",
    "Updated customer {name}",
    "Deleted customer #{id}",
    "Changed the price list of customer #{id}",
    "Set a contract price of {amount} for product #{id}",
    "Gave portal access to {email}",
    "Enabled portal account #{id}",
    "Disabled portal account #{id}",
    "Created product {name}",
    "Updated product {name}",
    "Deleted product #{id}",
    "Adjusted stock of product #{id} by {quantity} ({reason})",
    "Created category {name}",
    "Updated category {name}",
    "Deleted category #{id}",
    "Created order #{id}",
    "Moved order #{id} to {status}",
    "Recorded a {amount} payment on order #{id}",
    "Created {number} for {amount} on order #{id}",
    "Voided payment #{id}: {reason}",
    "Created quote #{id}",
    "Updated quote #{id}",
    "Deleted quote #{id}",
    "Created supplier {name}",
    "Updated supplier {name}",
    "Deleted supplier #{id}",
    "Created purchase order #{id}",
    "Updated purchase order #{id}",
    "Deleted purchase order #{id}",
    "Sent purchase order #{id}",
    "Received purchase order #{id}",
    "Cancelled purchase order #{id}",
    "Created draft purchase orders from reorder suggestions",
    "Created price list {name} (−{percent}%)",
    "Updated price list {name}",
    "Deleted price list #{id}",
    "Created a volume discount: {quantity}+ units −{percent}%",
    "Updated volume discount #{id}",
    "Deleted volume discount #{id}",
    "Removed contract price #{id}",
    "Created staff account {email}",
    "Updated staff account {email}",
    "Activated staff account #{id}",
    "Deactivated staff account #{id}",
    "Placed order #{id} from the portal",
    "Accepted quote #{id} from the portal",
    "Declined quote #{id} from the portal"
];

// Parts of price labels ("Gold −6%, 50+ units −4%"); price list names stay as typed.
const PRICE_LABELS = ["{quantity}+ units −{percent}"];

module.exports = [...STATUSES, ...Object.values(FIELD_LABELS), ...AUDIT_SUMMARIES, ...PRICE_LABELS];
