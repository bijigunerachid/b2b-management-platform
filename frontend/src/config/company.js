// Seller details printed on invoices. Replace with your company's real
// information; the identifiers below are placeholders.
const company = {
  name: "B2B Platform SARL",
  tagline: "Wholesale supplies for businesses",
  address: "123 Boulevard Mohammed V",
  city: "20000 Casablanca, Morocco",
  phone: "+212 5 22 00 00 00",
  email: "billing@b2bplatform.example",
  website: "b2bplatform.example",

  // Moroccan legal identifiers required on invoices.
  ice: "000000000000000",
  rc: "000000",
  taxId: "00000000",
  patente: "00000000",

  bank: {
    name: "Bank name",
    rib: "000 000 0000000000000000 00",
  },

  vatRate: 0.2,
  paymentTermsDays: 30,
};

export default company;
