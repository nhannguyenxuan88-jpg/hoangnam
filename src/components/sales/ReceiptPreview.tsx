import React from "react";
import { formatCurrency, formatDate } from "../../utils/format";
import type { CartItem } from "../../types";

interface StoreSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  bank_qr_url?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_branch?: string;
}

interface Props {
  receiptId: string;
  customerName?: string;
  customerPhone?: string;
  items: CartItem[];
  discount?: number;
  storeSettings?: StoreSettings | null;
}

const ReceiptPreview: React.FC<Props> = ({
  receiptId,
  customerName,
  customerPhone,
  items,
  discount = 0,
  storeSettings = null,
}) => {
  const total =
    items.reduce(
      (s, it) => s + (it.sellingPrice || 0) * (it.quantity || 0),
      0
    ) - (discount || 0);

  return (
    <div id="last-receipt" style={{ padding: 20, maxWidth: 680, position: "relative" }}>
      {/* Watermark Logo for Print */}
      {storeSettings?.logo_url && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "60%",
            height: "60%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <img
            src={storeSettings.logo_url}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: 0.08,
              filter: "grayscale(100%)",
            }}
          />
        </div>
      )}
      <div>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {storeSettings?.store_name || "Cửa hàng"}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {storeSettings?.address}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            {storeSettings?.phone && <div>Điện thoại: {storeSettings.phone}</div>}
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            HÓA ĐƠN BÁN HÀNG
          </h2>
          <div style={{ fontSize: 11, color: "#666" }}>
            Số: <strong style={{ color: "#000" }}>{receiptId}</strong> - Ngày:{" "}
            <strong>{formatDate(new Date(), true)}</strong>
          </div>
        </div>

        <div
          style={{ marginBottom: 12, padding: 10, backgroundColor: "#f8f9fa" }}
        >
          <div>
            <strong>Khách hàng:</strong> {customerName || "Khách lẻ"}
          </div>
          {customerPhone && (
            <div>
              <strong>Điện thoại:</strong> {customerPhone}
            </div>
          )}
        </div>

        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f1f3f5" }}>
              <th style={{ textAlign: "left", padding: 8, fontWeight: 700 }}>
                Sản phẩm
              </th>
              <th style={{ textAlign: "center", padding: 8, fontWeight: 700 }}>
                SL
              </th>
              <th style={{ textAlign: "right", padding: 8, fontWeight: 700 }}>
                Thành tiền
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td style={{ padding: 8 }}>{it.partName}</td>
                <td style={{ padding: 8, textAlign: "center" }}>{it.quantity}</td>
                <td style={{ padding: 8, textAlign: "right" }}>
                  {formatCurrency((it.sellingPrice || 0) * (it.quantity || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12, textAlign: "right", fontWeight: 700 }}>
          Tổng: {formatCurrency(total)}
        </div>
      </div>
    </div>
  );
};

export default ReceiptPreview;
