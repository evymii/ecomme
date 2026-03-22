'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, Download, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** A6 sheet fits fewer rows than A4; sequential № continues across pages */
const PAGE_SIZE = 10;
const REG_BOX_COUNT = 7;

/** ISO 216 A6 portrait */
const A6_MM = { w: 105, h: 148 } as const;
/** Inner content width with horizontal padding inside the sheet */
const RECEIPT_INNER_W_MM = 97;

interface OrderItem {
  product: { name: string; price?: number; code?: string };
  quantity: number;
  price: number;
  size?: string;
}

interface Order {
  _id: string;
  user?: {
    name: string;
    phoneNumber: string;
    email?: string;
  };
  phoneNumber?: string;
  email?: string;
  customerName?: string;
  items: OrderItem[];
  total: number;
  deliveryAddress: {
    address: string;
    additionalInfo?: string;
  } | string;
  paymentMethod?: string;
  payment?: {
    method?: string;
    paymentMethod?: string;
  };
  address?: {
    deliveryAddress?: string;
    additionalInfo?: string;
  } | string;
  orderCode?: string;
  status: string;
  createdAt: string;
}

interface OrderReceiptProps {
  order: Order;
}

function chunkOrderItems(items: OrderItem[]): OrderItem[][] {
  const list = items || [];
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE) || 1);
  const chunks: OrderItem[][] = [];
  for (let p = 0; p < pageCount; p++) {
    const start = p * PAGE_SIZE;
    chunks.push(list.slice(start, start + PAGE_SIZE));
  }
  return chunks;
}

function formatBarcodeDigits(orderCode: string | undefined): string {
  const digits = (orderCode || '').replace(/\D/g, '');
  const pad = digits.padStart(13, '0').slice(0, 13);
  if (!pad.replace(/0/g, '')) return '8 656000 715042';
  return `${pad[0]} ${pad.slice(1, 7)} ${pad.slice(7, 13)}`;
}

function ReceiptBarcodeVisual() {
  const bars = [
    2, 1, 3, 1, 1, 2, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 2, 1, 2, 1, 1, 2, 3, 1, 2, 1, 2, 1, 1, 2, 1, 3, 1, 2, 1,
  ];
  let x = 2;
  const rects = bars.map((w, i) => {
    const cx = x;
    x += w + 1;
    return <rect key={i} x={cx} y={2} width={w} height={86} fill="#000" />;
  });
  return (
    <svg width="48" height="64" viewBox="0 0 72 100" className="receipt-barcode-svg" aria-hidden style={{ display: 'block' }}>
      {rects}
    </svg>
  );
}

const PRINT_EMBEDDED_STYLES = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page {
    size: A6 portrait;
    margin: 4mm;
  }
  @media print {
    html, body {
      width: 97mm;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print {
      display: none !important;
    }
    .receipt-print-root {
      width: 97mm !important;
      max-width: 97mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    .receipt-a6-page {
      display: flex !important;
      flex-direction: column !important;
      width: 97mm !important;
      min-height: 132mm !important;
      box-sizing: border-box !important;
      page-break-after: always !important;
      break-after: page !important;
    }
    .receipt-a6-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .receipt-sheet-top { flex-shrink: 0 !important; width: 100% !important; }
    .receipt-sheet-tablewrap {
      flex: 1 1 auto !important;
      width: 100% !important;
      min-height: 0 !important;
    }
    .receipt-sheet-footer {
      flex-shrink: 0 !important;
      width: 100% !important;
      margin-top: auto !important;
    }
    .receipt-print-table {
      width: 97mm !important;
      max-width: 97mm !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }
    .receipt-print-table th,
    .receipt-print-table td {
      border: 1px solid #000 !important;
      padding: 1px 2px !important;
      font-size: 6.5px !important;
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
    }
    .receipt-print-table thead th {
      font-weight: bold !important;
      text-align: center !important;
      background-color: #fff !important;
    }
    .receipt-body-row td {
      height: 3.2mm !important;
    }
    .receipt-col-no { width: 5mm !important; }
    .receipt-col-name { width: 38mm !important; }
    .receipt-col-code { width: 11mm !important; }
    .receipt-col-unit { width: 10mm !important; }
    .receipt-col-qty { width: 10mm !important; }
    .receipt-col-price { width: 11mm !important; }
    .receipt-col-total { width: 12mm !important; }
  }
  @media screen {
    .receipt-a6-page {
      width: 105mm;
      max-width: min(105mm, calc(100vw - 24px));
      min-height: 148mm;
      box-sizing: border-box;
      margin: 0 auto 16px;
      padding: 4mm;
      background: #fff;
      border: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
    }
    .receipt-sheet-footer { margin-top: auto; }
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.3;
  }
  table {
    border-collapse: collapse;
    margin: 12px 0 8px;
    font-size: 10px;
  }
  th, td {
    border: 1px solid #000;
    padding: 4px;
    text-align: left;
  }
  th {
    font-weight: bold;
    text-align: center;
    background-color: #fff;
  }
`;

export default function OrderReceipt({ order }: OrderReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [receiptPage, setReceiptPage] = useState(1);

  const items = order.items || [];
  const chunks = useMemo(() => chunkOrderItems(items), [items]);
  const totalPages = chunks.length;
  const barcodeLabel = useMemo(() => formatBarcodeDigits(order.orderCode), [order.orderCode]);

  useEffect(() => {
    setReceiptPage(1);
  }, [order._id]);

  useEffect(() => {
    if (receiptPage > totalPages) setReceiptPage(totalPages);
  }, [receiptPage, totalPages]);

  const getOrderDeliveryAddress = () => {
    if (!order.deliveryAddress) return '-';
    if (typeof order.deliveryAddress === 'string') return order.deliveryAddress;
    if (order.deliveryAddress.address) return order.deliveryAddress.address;
    if (typeof order.address === 'string') return order.address;
    if (order.address?.deliveryAddress) return order.address.deliveryAddress;
    return '-';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year} оны ${month} сарын ${day} өдөр`;
  };

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=105, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
              <title>Захиалгын баримт - ${order.orderCode || order._id}</title>
              <style>${PRINT_EMBEDDED_STYLES}</style>
            </head>
            <body>
              ${receiptRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current || typeof window === 'undefined') return;

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const pages = receiptRef.current.querySelectorAll<HTMLElement>('.receipt-a6-page');
      if (pages.length === 0) return;

      const pdf = new jsPDF('p', 'mm', 'a6');
      const pageWidth = A6_MM.w;
      const pageHeight = A6_MM.h;

      for (let i = 0; i < pages.length; i++) {
        const el = pages[i];
        const canvas = await (html2canvas as (el: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>)(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: el.offsetWidth,
          height: el.offsetHeight,
        });

        const imgData = canvas.toDataURL('image/png');
        let drawW = pageWidth;
        let drawH = (canvas.height * drawW) / canvas.width;
        if (drawH > pageHeight) {
          drawH = pageHeight;
          drawW = (canvas.width * drawH) / canvas.height;
        }
        const offsetX = (pageWidth - drawW) / 2;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', offsetX, 0, drawW, drawH);
      }

      pdf.save(`Захиалгын_баримт_${order.orderCode || order._id}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      handlePrint();
    }
  };

  const handleDownloadPNG = async () => {
    if (!receiptRef.current || typeof window === 'undefined') return;

    try {
      const { default: html2canvas } = await import('html2canvas');
      const pages = receiptRef.current.querySelectorAll<HTMLElement>('.receipt-a6-page');
      if (pages.length === 0) return;

      const baseName = `Захиалгын_баримт_${order.orderCode || order._id}`;

      const triggerDownload = (href: string, filename: string) => {
        const a = document.createElement('a');
        a.href = href;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      for (let i = 0; i < pages.length; i++) {
        const el = pages[i];
        const canvas = await (html2canvas as (el: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>)(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: el.offsetWidth,
          height: el.offsetHeight,
        });
        const dataUrl = canvas.toDataURL('image/png');
        const filename =
          pages.length > 1 ? `${baseName}_хуудас${i + 1}.png` : `${baseName}.png`;
        triggerDownload(dataUrl, filename);
        if (i < pages.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } catch (error) {
      console.error('Error generating PNG:', error);
    }
  };

  const regBoxes = (
    <div style={{ display: 'flex', gap: '1px', flexWrap: 'nowrap', justifyContent: 'flex-start' }}>
      {Array.from({ length: REG_BOX_COUNT }, (_, i) => (
        <div
          key={i}
          style={{
            width: '3.5mm',
            height: '4mm',
            minWidth: '3.5mm',
            border: '1px solid #000',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );

  const renderHeaderBlock = () => (
    <div className="receipt-sheet-top" style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          fontSize: '9px',
          marginBottom: '8px',
          gap: '4mm',
        }}
      >
        <div style={{ flexShrink: 0 }}>НХМаяг БМ-3</div>
        <div style={{ textAlign: 'right', maxWidth: '42mm', lineHeight: 1.25, fontSize: '7px' }}>
          Сангийн сайдын 2017 оны 12 дугаар сарын 5-ны өдрийн<br />
          347 тоот тушаалын хавсралт
        </div>
      </div>

      <div
        style={{
          fontSize: '11px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
        }}
      >
        ЗАРЛАГИЙН БАРИМТ № {order.orderCode || order._id.slice(-8)}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '10px',
          fontSize: '11px',
          gap: '6mm',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '9px', marginBottom: '2px', textAlign: 'center' }}>(байгууллагын нэр)</div>
            <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', minHeight: '16px', textAlign: 'center' }}>
              Az Souvenir
            </div>
          </div>
          <div style={{ marginTop: '6px' }}>
            <div style={{ fontSize: '9px', marginBottom: '3px' }}>Регистрийн №</div>
            {regBoxes}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '9px', marginBottom: '2px', textAlign: 'center' }}>(худалдан авагчийн нэр)</div>
            <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', minHeight: '16px', textAlign: 'center' }}>
              {order.user?.name || order.customerName || 'Зочин'}
            </div>
          </div>
          <div style={{ marginTop: '6px' }}>
            <div style={{ fontSize: '9px', marginBottom: '3px' }}>Регистрийн №</div>
            {regBoxes}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: '6mm',
          marginBottom: '10px',
          fontSize: '11px',
        }}
      >
        <div style={{ flex: '0 0 auto', textAlign: 'center', paddingBottom: '2px' }}>{formatDate(order.createdAt)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '9px', marginBottom: '2px' }}>(тээвэрлэгчийн хаяг, албан тушаал, нэр)</div>
          <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', minHeight: '16px' }}>
            {getOrderDeliveryAddress()}
          </div>
        </div>
      </div>
    </div>
  );

  const renderFooterBlock = () => (
    <div
      className="footer receipt-sheet-footer"
      style={{
        marginTop: '4mm',
        paddingTop: '2mm',
        fontSize: '7px',
        width: '100%',
        borderTop: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '4mm',
          width: '100%',
        }}
      >
        <div style={{ width: '14mm', flexShrink: 0, alignSelf: 'flex-end' }}>
          <div style={{ fontSize: '6px', marginBottom: '2px' }}>Тэмдэг</div>
          <div
            style={{
              width: '12mm',
              height: '12mm',
              border: '1px dashed #000',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingLeft: '2mm', paddingRight: '2mm' }}>
          {[
            'Хүлээлгэн өгсөн эд хариуцагч',
            'Хүлээн авагч',
            'Шалгасан нягтлан бодогч',
          ].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: '6px',
                marginBottom: '4px',
              }}
            >
              <span style={{ whiteSpace: 'nowrap', fontSize: '6px' }}>{label}</span>
              <span
                style={{
                  flex: 1,
                  borderBottom: '1px dotted #000',
                  minHeight: '12px',
                  marginBottom: '1px',
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ width: '16mm', flexShrink: 0, textAlign: 'center', alignSelf: 'flex-end' }}>
          <ReceiptBarcodeVisual />
          <div
            style={{
              fontSize: '5px',
              letterSpacing: '0.02em',
              marginTop: '2px',
              fontFamily: 'Arial, Helvetica, monospace',
            }}
          >
            {barcodeLabel}
          </div>
        </div>
      </div>
    </div>
  );

  const cellBorder: CSSProperties = { border: '1px solid #000', padding: '1px 2px', fontSize: '7px' };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 no-print items-center">
        <Button onClick={handlePrint} variant="outline" size="sm">
          <Printer className="w-4 h-4 mr-2" />
          Хэвлэх
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          PDF татах
        </Button>
        <Button onClick={handleDownloadPNG} variant="outline" size="sm">
          <ImageIcon className="w-4 h-4 mr-2" />
          PNG татах
        </Button>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-sm ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={receiptPage <= 1}
              onClick={() => setReceiptPage((p) => Math.max(1, p - 1))}
            >
              Өмнөх
            </Button>
            <span className="text-gray-700 whitespace-nowrap">
              {receiptPage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={receiptPage >= totalPages}
              onClick={() => setReceiptPage((p) => Math.min(totalPages, p + 1))}
            >
              Дараах
            </Button>
          </div>
        )}
      </div>

      <div
        ref={receiptRef}
        className="receipt-print-root receipt-container bg-white w-full max-w-[105mm] mx-auto px-2 sm:px-0"
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          width: 'min(105mm, 100%)',
          maxWidth: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {chunks.map((chunk, pageIndex) => {
          const startIdx = pageIndex * PAGE_SIZE;
          const isLastPage = pageIndex === chunks.length - 1;
          const emptyRows = Math.max(0, PAGE_SIZE - chunk.length);
          const visibleOnScreen = receiptPage === pageIndex + 1;

          return (
            <div
              key={pageIndex}
              className="receipt-a6-page"
              style={{
                display: visibleOnScreen ? 'flex' : 'none',
                flexDirection: 'column',
                minHeight: `${A6_MM.h}mm`,
                width: 'min(105mm, calc(100vw - 16px))',
                maxWidth: '100%',
                margin: '0 auto',
                boxSizing: 'border-box',
              }}
            >
              {renderHeaderBlock()}

              <div className="receipt-sheet-tablewrap" style={{ width: '100%' }}>
                <table
                  className="receipt-print-table"
                  style={{
                    width: `${RECEIPT_INNER_W_MM}mm`,
                    maxWidth: '100%',
                    borderCollapse: 'collapse',
                    margin: '6px 0 0',
                    fontSize: '7px',
                    border: '1px solid #000',
                    tableLayout: 'fixed',
                  }}
                >
                  <colgroup>
                    <col className="receipt-col-no" />
                    <col className="receipt-col-name" />
                    <col className="receipt-col-code" />
                    <col className="receipt-col-unit" />
                    <col className="receipt-col-qty" />
                    <col className="receipt-col-price" />
                    <col className="receipt-col-total" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ ...cellBorder, textAlign: 'center' }}>№</th>
                      <th style={{ ...cellBorder, textAlign: 'center' }}>
                        Материалын үнэт зүйлийн нэр, зэрэг, дугаар
                      </th>
                      <th style={{ ...cellBorder, textAlign: 'center' }}>Код</th>
                      <th style={{ ...cellBorder, textAlign: 'center' }}>
                        Хэм-<br />жих нэгж
                      </th>
                      <th style={{ ...cellBorder, textAlign: 'center' }}>Тоо</th>
                      <th style={{ ...cellBorder, textAlign: 'center' }}>
                        Худалдах
                        <br />
                        Нэгжийн үнэ
                      </th>
                      <th style={{ ...cellBorder, textAlign: 'center' }}>Нийт дүн</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunk.map((item, index) => {
                      const rowNum = startIdx + index + 1;
                      return (
                        <tr key={`${pageIndex}-${index}`} className="receipt-body-row">
                          <td style={{ ...cellBorder, textAlign: 'center' }}>{rowNum}</td>
                          <td style={{ ...cellBorder }}>{item.product?.name || 'Устгагдсан бараа'}</td>
                          <td style={{ ...cellBorder, textAlign: 'center' }}>{item.product?.code || '-'}</td>
                          <td style={{ ...cellBorder, textAlign: 'center' }}>ш</td>
                          <td style={{ ...cellBorder, textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ ...cellBorder, textAlign: 'right' }}>₮{(item.price || 0).toLocaleString()}</td>
                          <td style={{ ...cellBorder, textAlign: 'right' }}>
                            ₮{((item.price || 0) * (item.quantity || 0)).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {Array.from({ length: emptyRows }).map((_, index) => {
                      const rowNum = startIdx + chunk.length + index + 1;
                      return (
                        <tr key={`empty-${pageIndex}-${index}`} className="receipt-body-row">
                          <td style={{ ...cellBorder, textAlign: 'center' }}>{rowNum}</td>
                          <td style={cellBorder}></td>
                          <td style={cellBorder}></td>
                          <td style={cellBorder}></td>
                          <td style={cellBorder}></td>
                          <td style={cellBorder}></td>
                          <td style={cellBorder}></td>
                        </tr>
                      );
                    })}
                    {isLastPage && (
                      <tr>
                        <td colSpan={2} style={{ ...cellBorder, fontWeight: 'bold' }}>
                          Дүн
                        </td>
                        <td style={cellBorder}></td>
                        <td style={cellBorder}></td>
                        <td style={cellBorder}></td>
                        <td style={cellBorder}></td>
                        <td style={{ ...cellBorder, textAlign: 'right', fontWeight: 'bold', fontSize: '8px' }}>
                          ₮{(order.total || 0).toLocaleString()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {renderFooterBlock()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
