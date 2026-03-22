'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const REG_BOX_COUNT = 7;

/** A4 @ 96dpi — full page and inner content (10mm margins ≈ 38px). */
const A4_PX = {
  pageW: 794,
  pageH: 1123,
  pad: 38,
  innerW: 718,
  rowH: 22,
} as const;

/** Fixed columns (px); name fills remainder of inner width. */
const A4_COL_PX = {
  no: 28,
  code: 64,
  unit: 32,
  qty: 32,
  price: 52,
  total: 52,
} as const;

const A4_NAME_PX =
  A4_PX.innerW - (A4_COL_PX.no + A4_COL_PX.code + A4_COL_PX.unit + A4_COL_PX.qty + A4_COL_PX.price + A4_COL_PX.total);

export type PaperFormat = 'a4' | 'a5' | 'a6';

interface ColWidths {
  no: number;
  name: number;
  code: number;
  unit: number;
  qty: number;
  price: number;
  total: number;
}

interface PaperPreset {
  id: PaperFormat;
  label: string;
  pageSizeName: 'A4' | 'A5' | 'A6';
  sheetW: number;
  sheetH: number;
  pageMarginMm: number;
  innerW: number;
  rowsPerPage: number;
  jspdf: 'a4' | 'a5' | 'a6';
  cols: ColWidths;
  rowHeightMm: number;
  printCellPaddingPx: number;
  printFontPx: number;
  titlePx: number;
  legalNoteMaxMm: number;
  stampMm: number;
  regBoxWmm: number;
  regBoxHmm: number;
  footerFontPx: number;
  signatureFontPx: number;
  totalRowFontPx: number;
}

const PAPER_PRESETS: Record<PaperFormat, PaperPreset> = {
  a4: {
    id: 'a4',
    label: 'A4',
    pageSizeName: 'A4',
    sheetW: 210,
    sheetH: 297,
    pageMarginMm: 10,
    innerW: 190,
    rowsPerPage: 20,
    jspdf: 'a4',
    cols: { no: 8, name: 72, code: 16, unit: 14, qty: 14, price: 22, total: 24 },
    rowHeightMm: 7.2,
    printCellPaddingPx: 2,
    printFontPx: 9,
    titlePx: 16,
    legalNoteMaxMm: 95,
    stampMm: 22,
    regBoxWmm: 6,
    regBoxHmm: 5,
    footerFontPx: 10,
    signatureFontPx: 9,
    totalRowFontPx: 10,
  },
  a5: {
    id: 'a5',
    label: 'A5',
    pageSizeName: 'A5',
    sheetW: 148,
    sheetH: 210,
    pageMarginMm: 8,
    innerW: 132,
    rowsPerPage: 14,
    jspdf: 'a5',
    cols: { no: 6, name: 56, code: 12, unit: 11, qty: 11, price: 17, total: 19 },
    rowHeightMm: 5.2,
    printCellPaddingPx: 2,
    printFontPx: 8,
    titlePx: 13,
    legalNoteMaxMm: 62,
    stampMm: 18,
    regBoxWmm: 5,
    regBoxHmm: 4,
    footerFontPx: 8,
    signatureFontPx: 7,
    totalRowFontPx: 9,
  },
  a6: {
    id: 'a6',
    label: 'A6',
    pageSizeName: 'A6',
    sheetW: 105,
    sheetH: 148,
    pageMarginMm: 5,
    innerW: 95,
    rowsPerPage: 10,
    jspdf: 'a6',
    cols: { no: 5, name: 35, code: 9, unit: 8, qty: 8, price: 13, total: 13 },
    rowHeightMm: 3.6,
    printCellPaddingPx: 2,
    printFontPx: 6.5,
    titlePx: 11,
    legalNoteMaxMm: 42,
    stampMm: 12,
    regBoxWmm: 3.5,
    regBoxHmm: 3.5,
    footerFontPx: 7,
    signatureFontPx: 6,
    totalRowFontPx: 8,
  },
};

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
  deliveryAddress:
    | {
        address: string;
        additionalInfo?: string;
      }
    | string;
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

const MM_TO_PX = 96 / 25.4;

function pagesForReceipt(items: OrderItem[], rowsPerPage: number): (OrderItem | null)[][] {
  const list = items || [];
  const pageCount = Math.max(1, Math.ceil(list.length / rowsPerPage) || 1);
  const pages: (OrderItem | null)[][] = [];
  for (let p = 0; p < pageCount; p++) {
    const slice = list.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
    const padded: (OrderItem | null)[] = [...slice];
    while (padded.length < rowsPerPage) {
      padded.push(null);
    }
    pages.push(padded);
  }
  return pages;
}

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function isValidCanvasSize(canvas: HTMLCanvasElement): boolean {
  const w = canvas.width;
  const h = canvas.height;
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
}

function applyCapturePixelBox(el: HTMLElement, sheetWmm: number, sheetHmm: number) {
  const rect = el.getBoundingClientRect();
  let w = Math.round(rect.width);
  let h = Math.round(rect.height);
  if (!w || !h) {
    w = Math.max(1, Math.round(sheetWmm * MM_TO_PX));
    h = Math.max(1, Math.round(sheetHmm * MM_TO_PX));
  }
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.boxSizing = 'border-box';
}

function buildPrintEmbeddedStyles(p: PaperPreset): string {
  const c = p.cols;
  const pageWmm = p.sheetW;
  const pageHmm = p.sheetH;
  return `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page {
    size: ${p.pageSizeName} portrait;
    margin: 0mm;
  }
  @media print {
    body { margin: 0; padding: 0; }
    .no-print { display: none !important; }
    .receipt-page {
      width: ${pageWmm}mm !important;
      height: ${pageHmm}mm !important;
      padding: ${p.pageMarginMm}mm !important;
      page-break-after: always !important;
      overflow: hidden !important;
      box-shadow: none !important;
      display: flex !important;
      flex-direction: column !important;
      box-sizing: border-box !important;
    }
    .receipt-page:last-child {
      page-break-after: avoid !important;
    }
    .receipt-print-root {
      width: ${pageWmm}mm !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .receipt-sheet-top { flex-shrink: 0 !important; width: 100% !important; }
    .receipt-sheet-tablewrap {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      overflow: hidden !important;
    }
    .receipt-sheet-footer {
      flex-shrink: 0 !important;
      margin-top: auto !important;
    }
    .receipt-print-table {
      width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }
    .receipt-print-table th,
    .receipt-print-table td {
      border: 0.5px solid #333 !important;
      padding: 2px 3px !important;
      vertical-align: middle !important;
      overflow: hidden !important;
    }
    .receipt-body-row td { page-break-inside: avoid !important; }
    .receipt-col-no { width: ${c.no}mm !important; }
    .receipt-col-name { width: ${c.name}mm !important; }
    .receipt-col-code { width: ${c.code}mm !important; }
    .receipt-col-unit { width: ${c.unit}mm !important; }
    .receipt-col-qty { width: ${c.qty}mm !important; }
    .receipt-col-price { width: ${c.price}mm !important; }
    .receipt-col-total { width: ${c.total}mm !important; }
  }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11px;
    line-height: 1.3;
  }
`;
}

export default function OrderReceipt({ order }: OrderReceiptProps) {
  const { toast } = useToast();
  const receiptPrintRootRef = useRef<HTMLDivElement>(null);
  const [paperFormat, setPaperFormat] = useState<PaperFormat>('a4');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pngLoading, setPngLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const preset = PAPER_PRESETS[paperFormat];
  const items = order.items || [];
  const paddedPages = useMemo(() => pagesForReceipt(items, preset.rowsPerPage), [items, preset.rowsPerPage]);
  const totalPages = paddedPages.length;

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

  const regBoxes = (
    <div style={{ display: 'flex', gap: '2px', flexWrap: 'nowrap', justifyContent: 'flex-start' }}>
      {Array.from({ length: REG_BOX_COUNT }, (_, i) => (
        <div
          key={i}
          style={{
            width: `${preset.regBoxWmm}mm`,
            height: `${preset.regBoxHmm}mm`,
            minWidth: `${preset.regBoxWmm}mm`,
            border: '1px solid #000',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );

  const renderHeaderBlock = () => (
    <div className="receipt-sheet-top" style={{ width: '100%', flexShrink: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          fontSize: preset.id === 'a6' ? '7px' : '9px',
          marginBottom: '8px',
          gap: '4mm',
        }}
      >
        <div style={{ flexShrink: 0 }}>НХМаяг БМ-3</div>
        <div style={{ textAlign: 'right', maxWidth: `${preset.legalNoteMaxMm}mm`, lineHeight: 1.35, fontSize: '9px' }}>
          Сангийн сайдын 2017 оны 12 дугаар сарын 5-ны өдрийн<br />
          347 тоот тушаалын хавсралт
        </div>
      </div>

      <div
        style={{
          fontSize: `${preset.titlePx}px`,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '14px',
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
          fontSize: preset.id === 'a6' ? '9px' : '11px',
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
          fontSize: preset.id === 'a6' ? '9px' : '11px',
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
      className="receipt-sheet-footer receipt-footer"
      style={{
        marginTop: 'auto',
        paddingTop: '12px',
        flexShrink: 0,
        fontSize: `${preset.footerFontPx}px`,
        width: '100%',
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
        <div style={{ width: `${preset.stampMm + 4}mm`, flexShrink: 0, alignSelf: 'flex-end' }}>
          <div style={{ fontSize: `${preset.signatureFontPx}px`, marginBottom: '4px' }}>Тамга</div>
          <div
            style={{
              width: `${preset.stampMm}mm`,
              height: `${preset.stampMm}mm`,
              border: '1px dashed #000',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingLeft: '2mm', paddingRight: '2mm' }}>
          {['Хүлээлгэн өгсөн эд хариуцагч', 'Хүлээн авагч', 'Шалгасан нягтлан бодогч'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: '6px',
                marginBottom: '10px',
              }}
            >
              <span style={{ whiteSpace: 'nowrap', fontSize: `${preset.signatureFontPx}px` }}>{label}</span>
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
      </div>
    </div>
  );

  const cellStyleA4: CSSProperties = {
    border: '0.5px solid #333',
    padding: '2px 3px',
    fontSize: '9px',
    verticalAlign: 'middle',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  };

  const cellStyleMm: CSSProperties = {
    border: '1px solid #000',
    padding: preset.id === 'a6' ? '2px' : '3px',
    fontSize: preset.id === 'a6' ? '7px' : '9px',
    verticalAlign: 'middle',
  };

  const renderTableRows = (
    pageItems: (OrderItem | null)[],
    pageIndex: number,
    isLastPage: boolean,
    useA4Px: boolean
  ) => {
    const startIdx = pageIndex * preset.rowsPerPage;
    const tdBase = useA4Px ? cellStyleA4 : cellStyleMm;

    return (
      <>
        {pageItems.map((item, i) => {
          const rowNum = item ? startIdx + i + 1 : '';
          return (
            <tr
              key={`${pageIndex}-${i}`}
              className="receipt-body-row"
              style={{ height: useA4Px ? '22px' : `${preset.rowHeightMm}mm` }}
            >
              <td style={{ ...tdBase, textAlign: 'center', width: useA4Px ? A4_COL_PX.no : undefined }}>{rowNum}</td>
              <td style={{ ...tdBase, width: useA4Px ? A4_NAME_PX : undefined }}>
                {item ? item.product?.name || 'Устгагдсан бараа' : ''}
              </td>
              <td style={{ ...tdBase, textAlign: 'center', width: useA4Px ? A4_COL_PX.code : undefined }}>
                {item ? item.product?.code || '-' : ''}
              </td>
              <td style={{ ...tdBase, textAlign: 'center', width: useA4Px ? A4_COL_PX.unit : undefined }}>
                {item ? 'ш' : ''}
              </td>
              <td style={{ ...tdBase, textAlign: 'center', width: useA4Px ? A4_COL_PX.qty : undefined }}>
                {item ? item.quantity : ''}
              </td>
              <td style={{ ...tdBase, textAlign: 'right', width: useA4Px ? A4_COL_PX.price : undefined }}>
                {item ? `₮${(item.price || 0).toLocaleString()}` : ''}
              </td>
              <td style={{ ...tdBase, textAlign: 'right', width: useA4Px ? A4_COL_PX.total : undefined }}>
                {item ? `₮${((item.price || 0) * (item.quantity || 0)).toLocaleString()}` : ''}
              </td>
            </tr>
          );
        })}
        {isLastPage && (
          <tr style={{ borderTop: '1px solid #000', fontWeight: 'bold' }}>
            <td colSpan={6} style={{ ...tdBase, textAlign: 'right', borderTop: '1px solid #000' }}>
              Дүн
            </td>
            <td
              style={{
                ...tdBase,
                textAlign: 'right',
                fontWeight: 'bold',
                fontSize: `${preset.totalRowFontPx}px`,
                borderTop: '1px solid #000',
              }}
            >
              ₮{(order.total || 0).toLocaleString()}
            </td>
          </tr>
        )}
      </>
    );
  };

  const renderOnePage = (pageItems: (OrderItem | null)[], pageIndex: number, isLastPage: boolean, variant: 'preview' | 'capture') => {
    const useA4Px = paperFormat === 'a4';
    const pageClass = cn('receipt-page', paperFormat === 'a4' && 'receipt-page--a4');
    const thBase = useA4Px ? cellStyleA4 : cellStyleMm;

    const tableWrap = (
      <div className="receipt-sheet-tablewrap" style={{ flex: 1, minHeight: 0, overflow: 'hidden', width: '100%' }}>
        <table
          className="receipt-print-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            fontSize: useA4Px ? '9px' : preset.id === 'a6' ? '7px' : '9px',
            margin: 0,
          }}
        >
          <colgroup>
            {useA4Px ? (
              <>
                <col style={{ width: A4_COL_PX.no }} />
                <col style={{ width: A4_NAME_PX }} />
                <col style={{ width: A4_COL_PX.code }} />
                <col style={{ width: A4_COL_PX.unit }} />
                <col style={{ width: A4_COL_PX.qty }} />
                <col style={{ width: A4_COL_PX.price }} />
                <col style={{ width: A4_COL_PX.total }} />
              </>
            ) : (
              <>
                <col className="receipt-col-no" style={{ width: `${preset.cols.no}mm` }} />
                <col className="receipt-col-name" style={{ width: `${preset.cols.name}mm` }} />
                <col className="receipt-col-code" style={{ width: `${preset.cols.code}mm` }} />
                <col className="receipt-col-unit" style={{ width: `${preset.cols.unit}mm` }} />
                <col className="receipt-col-qty" style={{ width: `${preset.cols.qty}mm` }} />
                <col className="receipt-col-price" style={{ width: `${preset.cols.price}mm` }} />
                <col className="receipt-col-total" style={{ width: `${preset.cols.total}mm` }} />
              </>
            )}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'center', background: '#f0f0f0', fontWeight: 'bold', fontSize: '8px' }}>№</th>
              <th style={{ ...thBase, textAlign: 'center', background: '#f0f0f0', fontWeight: 'bold', fontSize: '8px' }}>
                Материалын үнэт зүйлийн нэр, зэрэг, дугаар
              </th>
              <th style={{ ...thBase, textAlign: 'center', background: '#f0f0f0', fontWeight: 'bold', fontSize: '8px' }}>Код</th>
              <th style={{ ...thBase, textAlign: 'center', background: '#f0f0f0', fontWeight: 'bold', fontSize: '8px' }}>
                Хэм-
                <br />
                жих нэгж
              </th>
              <th style={{ ...thBase, textAlign: 'center', background: '#f0f0f0', fontWeight: 'bold', fontSize: '8px' }}>Тоо</th>
              <th style={{ ...thBase, textAlign: 'center', background: '#f0f0f0', fontWeight: 'bold', fontSize: '8px' }}>
                Худалдах
                <br />
                Нэгжийн үнэ
              </th>
              <th style={{ ...thBase, textAlign: 'center', background: '#f0f0f0', fontWeight: 'bold', fontSize: '8px' }}>Нийт дүн</th>
            </tr>
          </thead>
          <tbody>{renderTableRows(pageItems, pageIndex, isLastPage, useA4Px)}</tbody>
        </table>
      </div>
    );

    if (paperFormat === 'a4') {
      return (
        <div
          key={`${variant}-${paperFormat}-${pageIndex}`}
          className={pageClass}
          data-capture={variant}
          style={{
            width: A4_PX.pageW,
            height: A4_PX.pageH,
            padding: A4_PX.pad,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#fff',
            fontFamily: '"Times New Roman", Times, serif',
            pageBreakAfter: isLastPage ? 'avoid' : 'always',
          }}
        >
          {renderHeaderBlock()}
          {tableWrap}
          {renderFooterBlock()}
        </div>
      );
    }

    return (
      <div
        key={`${variant}-${paperFormat}-${pageIndex}`}
        className={pageClass}
        data-capture={variant}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: `min(${preset.sheetW}mm, calc(100vw - 16px))`,
          maxWidth: '100%',
          minHeight: `${preset.sheetH}mm`,
          margin: '0 auto 16px',
          padding: preset.id === 'a6' ? '4mm' : '8mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: '#fff',
          border: variant === 'preview' ? '1px solid #e5e7eb' : undefined,
          pageBreakAfter: isLastPage ? 'avoid' : 'always',
        }}
      >
        {renderHeaderBlock()}
        {tableWrap}
        {renderFooterBlock()}
      </div>
    );
  };

  const receiptPagesJsx = (variant: 'preview' | 'capture') => (
    <>
      {paddedPages.map((pageItems, pageIndex) =>
        renderOnePage(pageItems, pageIndex, pageIndex === paddedPages.length - 1, variant)
      )}
    </>
  );

  const handlePrint = async () => {
    const root = receiptPrintRootRef.current;
    if (!root || typeof window === 'undefined' || printLoading) return;
    setPrintLoading(true);
    await doubleRaf();
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const styles = buildPrintEmbeddedStyles(preset);
        printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Захиалгын баримт - ${order.orderCode || order._id}</title><style>${styles}</style></head><body>${root.innerHTML}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        await doubleRaf();
        printWindow.print();
      }
    } catch (e) {
      console.error('OrderReceipt print: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPrintLoading(false);
    }
  };

  const capturePageDimensions = () => {
    if (paperFormat === 'a4') {
      return { width: A4_PX.pageW, height: A4_PX.pageH };
    }
    return {
      width: Math.round(preset.sheetW * MM_TO_PX),
      height: Math.round(preset.sheetH * MM_TO_PX),
    };
  };

  const handleDownloadPDF = async () => {
    if (typeof window === 'undefined' || isGenerating) return;
    const container = document.getElementById('receipt-pdf-container');
    if (!container) {
      toast({ title: 'PDF үүсгэхэд алдаа гарлаа', variant: 'destructive' });
      return;
    }

    const pageEls = Array.from(container.querySelectorAll<HTMLElement>('.receipt-page'));
    if (pageEls.length === 0) {
      toast({ title: 'PDF үүсгэхэд алдаа гарлаа', variant: 'destructive' });
      return;
    }

    const { width: capW, height: capH } = capturePageDimensions();

    setIsGenerating(true);
    try {
      await doubleRaf();
      await doubleRaf();

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const doc = new jsPDF('p', 'mm', preset.jspdf);

      for (let i = 0; i < pageEls.length; i++) {
        const page = pageEls[i];
        const canvas = await (html2canvas as (node: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>)(page, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: capW,
          height: capH,
          windowWidth: capW,
        });

        if (!isValidCanvasSize(canvas)) {
          toast({ title: 'PDF үүсгэхэд алдаа гарлаа', variant: 'destructive' });
          return;
        }

        const imgData = canvas.toDataURL('image/png');
        if (i > 0) doc.addPage();
        const pageWmm = preset.sheetW;
        const pageHmm = preset.sheetH;
        doc.addImage(imgData, 'PNG', 0, 0, pageWmm, pageHmm);
      }

      doc.save(`receipt-${String(order.orderCode || order._id)}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast({ title: 'PDF үүсгэхэд алдаа гарлаа', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (typeof window === 'undefined' || pngLoading) return;
    const container = document.getElementById('receipt-pdf-container');
    if (!container) return;

    const pageEls = Array.from(container.querySelectorAll<HTMLElement>('.receipt-page'));
    if (pageEls.length === 0) return;

    const { width: capW, height: capH } = capturePageDimensions();

    setPngLoading(true);
    await doubleRaf();
    try {
      const { default: html2canvas } = await import('html2canvas');
      const baseName = `Захиалгын_баримт_${preset.label}_${order.orderCode || order._id}`;

      const triggerDownload = (href: string, filename: string) => {
        const a = document.createElement('a');
        a.href = href;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      for (let i = 0; i < pageEls.length; i++) {
        const el = pageEls[i];
        const prevW = el.style.width;
        const prevH = el.style.height;
        const prevBox = el.style.boxSizing;
        try {
          applyCapturePixelBox(el, preset.sheetW, preset.sheetH);
          await doubleRaf();

          const canvas = await (html2canvas as (node: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>)(el, {
            scale: 2,
            useCORS: true,
            logging: false,
            width: capW,
            height: capH,
            windowWidth: capW,
          });

          if (!isValidCanvasSize(canvas)) continue;

          const dataUrl = canvas.toDataURL('image/png');
          const filename = pageEls.length > 1 ? `${baseName}_хуудас${i + 1}.png` : `${baseName}.png`;
          triggerDownload(dataUrl, filename);
        } catch (e) {
          console.error('OrderReceipt PNG: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
          el.style.width = prevW;
          el.style.height = prevH;
          el.style.boxSizing = prevBox;
        }
        if (i < pageEls.length - 1) await doubleRaf();
      }
    } finally {
      setPngLoading(false);
    }
  };

  const portalContent =
    mounted &&
    createPortal(
      <div
        id="receipt-pdf-container"
        aria-hidden
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: paperFormat === 'a4' ? A4_PX.pageW : Math.round(preset.sheetW * MM_TO_PX),
          zIndex: -1,
          pointerEvents: 'none',
        }}
      >
        <div className="receipt-print-root receipt-capture-root">{receiptPagesJsx('capture')}</div>
      </div>,
      document.body
    );

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 no-print items-center">
        <div className="flex flex-wrap items-center gap-1.5 mr-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Хэмжээ:</span>
          {(['a4', 'a5', 'a6'] as const).map((fmt) => (
            <Button
              key={fmt}
              type="button"
              variant={paperFormat === fmt ? 'default' : 'outline'}
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setPaperFormat(fmt)}
            >
              {PAPER_PRESETS[fmt].label}
            </Button>
          ))}
        </div>
        <Button onClick={handlePrint} variant="outline" size="sm" disabled={printLoading}>
          <Printer className="w-4 h-4 mr-2" />
          {printLoading ? 'Уншиж байна...' : 'Хэвлэх'}
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" size="sm" disabled={isGenerating}>
          <Download className="w-4 h-4 mr-2" />
          {isGenerating ? 'Үүсгэж байна...' : 'PDF татах'}
        </Button>
        <Button onClick={handleDownloadPNG} variant="outline" size="sm" disabled={pngLoading}>
          <ImageIcon className="w-4 h-4 mr-2" />
          {pngLoading ? 'Уншиж байна...' : 'PNG татах'}
        </Button>
        {totalPages > 1 && (
          <span className="text-sm text-muted-foreground ml-auto">{totalPages} хуудас</span>
        )}
      </div>

      <div
        id="receipt-preview"
        className="receipt-modal-scroll"
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          maxHeight: '80vh',
          padding: '0 8px',
        }}
      >
        <div
          id="receipt-print-root"
          ref={receiptPrintRootRef}
          className="receipt-print-root receipt-container bg-white w-full mx-auto"
          style={{
            width: paperFormat === 'a4' ? A4_PX.pageW : `min(${preset.sheetW}mm, 100%)`,
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          {receiptPagesJsx('preview')}
        </div>
      </div>

      {portalContent}
    </div>
  );
}
