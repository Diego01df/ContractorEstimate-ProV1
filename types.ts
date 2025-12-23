
export interface LineItem {
  id: string;
  category: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number; 
  laborRate: number; 
  markup: number; 
  ecoProfit: number; // Restored per-item profit
  notes: string;
  paymentDue: string;
}

export interface Room {
  id: string;
  name: string;
  items: LineItem[];
  scopeOfWork: string;
  photo?: string; // Base64 encoded string
}

export interface ProjectAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Project {
  id: string;
  title: string;
  address: ProjectAddress;
  rooms: Room[];
  contingencyPct: number; 
  taxPct: number;
  discountPct: number;
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export const CATEGORIES = [
  "Initial Deposit_Project Start",
  "Site Prep / Demolition",
  "Structural / Framing",
  "Foundation / Concrete",
  "Roofing",
  "Exterior Envelope",
  "Windows / Doors",
  "MEP Rough",
  "Insulation",
  "Drywall / Interior",
  "Finishes (Paint, Trim)",
  "Cabinets / Millwork",
  "Fixtures / Faucets",
  "Appliances",
  "Tile / Stone",
  "Landscaping",
  "Permits / Fees",
  "Cleanup",
  "Custom Work"
];

export const PAYMENT_TERMS = [
  "Upon contract signing",
  "Upon completion of previous phase",
  "Upon passing rough inspection",
  "Upon final approval"
];

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Initial Deposit_Project Start": "Upfront payment to secure scheduling and mobilize resources.",
  "Site Prep / Demolition": "Clearing site, removing old structures, and preparing for construction.",
  "Structural / Framing": "Building the skeleton, walls, floors, and roof support systems.",
  "Foundation / Concrete": "Pouring footings, slabs, and structural concrete elements.",
  "Roofing": "Installing roof covering, flashing, and weatherproofing materials.",
  "Exterior Envelope": "Siding, stucco, weather barriers, and exterior trim installation.",
  "Windows / Doors": "Installation of exterior and interior doors and window units.",
  "MEP Rough": "Rough installation of mechanical, electrical, and plumbing systems.",
  "Insulation": "Thermal and sound insulation in walls, ceilings, and floors.",
  "Drywall / Interior": "Hanging, taping, and texturing drywall for interior walls.",
  "Finishes (Paint, Trim)": "Painting, staining, and installing baseboards, crown molding, and casings.",
  "Cabinets / Millwork": "Installation of cabinetry, shelving, and custom woodwork.",
  "Fixtures / Faucets": "Installing sinks, toilets, lights, and plumbing trim.",
  "Appliances": "Placement and connection of kitchen and laundry appliances.",
  "Tile / Stone": "Laying ceramic, porcelain, or natural stone on floors/walls.",
  "Landscaping": "Planting, irrigation, hardscaping, and outdoor improvements.",
  "Permits / Fees": "City permits, inspections, and administrative costs.",
  "Cleanup": "Final site cleaning and debris removal.",
  "Custom Work": "Specialized tasks or unique requirements not covered by standard categories."
};

export const DEFAULT_ROOMS = [
  "Kitchen", "Master Bath", "Guest Bath", "Living Room", "Dining Room", "Bedroom", "Hallway", "Garage"
];
