import {rows} from "@/lib/clearpath";
import {Badge, PageHead} from "@/components/Portal";
import {UnavailableButton} from "../PageControls";
import VendorContact from "./VendorContact";

export default function Vendors() {
  const vendors = rows("SELECT * FROM cp_vendors");
  return <div className="page">
    <PageHead
      eyebrow="RESEARCH NETWORK"
      title="Vendor Directory"
      subtitle="Approved screening and court research partners."
      actions={<UnavailableButton className="btn primary" reason="Vendor creation is disabled in this demo">+ Add Vendor</UnavailableButton>}
    />
    <div className="vendor-grid">
      {vendors.map(vendor => <section className="card vendor" key={String(vendor.id)}>
        <div><span>{String(vendor.name).split(" ").map(part => part[0]).join("").slice(0, 2)}</span><Badge tone="green">{vendor.status}</Badge></div>
        <h2>{vendor.name}</h2>
        <p>{vendor.coverage}</p>
        <dl>
          <dt>Jurisdictions</dt><dd>{vendor.jurisdictions}</dd>
          <dt>Average turnaround</dt><dd>{vendor.turnaround}</dd>
          <dt>Standard cost</dt><dd>${vendor.cost}</dd>
          <dt>Quality score</dt><dd><b>{vendor.quality}%</b></dd>
          <dt>Contact</dt><dd>{vendor.contact}</dd>
        </dl>
        {vendor.preferred === 1 && <Badge tone="blue">★ Preferred Vendor</Badge>}
        <VendorContact vendorId={Number(vendor.id)} vendorName={String(vendor.name)} />
      </section>)}
    </div>
  </div>;
}
