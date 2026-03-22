'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, Download, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const REG_BOX_COUNT = 7;

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
  minPageBodyH: number;
  rowsPerPage: number;
  jspdf: 'a4' | 'a5' | 'a6';
  viewport: number;
  cols: ColWidths;
  rowHeightMm: number;
  printCellPaddingPx: number;
  printFontPx: number;
  titlePx: number;
  legalNoteMaxMm: number;
  stampMm: number;
  barcodeWmm: number;
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
    minPageBodyH: 277,
    rowsPerPage: 20,
    jspdf: 'a4',
    viewport: 210,
    cols: { no: 8, name: 72, code: 16, unit: 14, qty: 14, price: 22, total: 24 },
    rowHeightMm: 7.2,
    printCellPaddingPx: 4,
    printFontPx: 10,
    titlePx: 16,
    legalNoteMaxMm: 95,
    stampMm: 22,
    barcodeWmm: 28,
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
    minPageBodyH: 194,
    rowsPerPage: 14,
    jspdf: 'a5',
    viewport: 148,
    cols: { no: 6, name: 56, code: 12, unit: 11, qty: 11, price: 17, total: 19 },
    rowHeightMm: 5.2,
    printCellPaddingPx: 3,
    printFontPx: 8,
    titlePx: 13,
    legalNoteMaxMm: 62,
    stampMm: 18,
    barcodeWmm: 22,
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
    minPageBodyH: 138,
    rowsPerPage: 10,
    jspdf: 'a6',
    viewport: 105,
    cols: { no: 5, name: 35, code: 9, unit: 8, qty: 8, price: 13, total: 13 },
    rowHeightMm: 3.6,
    printCellPaddingPx: 2,
    printFontPx: 6.5,
    titlePx: 11,
    legalNoteMaxMm: 42,
    stampMm: 12,
    barcodeWmm: 16,
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

function chunkOrderItems(items: OrderItem[], rowsPerPage: number): OrderItem[][] {
  const list = items || [];
  const pageCount = Math.max(1, Math.ceil(list.length / rowsPerPage) || 1);
  const chunks: OrderItem[][] = [];
  for (let p = 0; p < pageCount; p++) {
    const start = p * rowsPerPage;
    chunks.push(list.slice(start, start + rowsPerPage));
  }
  return chunks;
}

const MM_TO_PX = 96 / 25.4;

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

async function withSinglePageVisible<T>(
  pages: HTMLElement[],
  pageIndex: number,
  run: (el: HTMLElement) => Promise<T>
): Promise<T> {
  const prev = pages.map((p) => p.style.display);
  pages.forEach((p, j) => {
    p.style.display = j === pageIndex ? 'flex' : 'none';
  });
  await doubleRaf();
  try {
    return await run(pages[pageIndex]);
  } finally {
    pages.forEach((p, i) => {
      p.style.display = prev[i];
    });
  }
}

function formatBarcodeDigits(orderCode: string | undefined): string {
  const digits = (orderCode || '').replace(/\D/g, '');
  const pad = digits.padStart(13, '0').slice(0, 13);
  if (!pad.replace(/0/g, '')) return '8 656000 715042';
  return `${pad[0]} ${pad.slice(1, 7)} ${pad.slice(7, 13)}`;
}

function ReceiptBarcodeVisual({ compact }: { compact?: boolean }) {
  const bars = [
    2, 1, 3, 1, 1, 2, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 2, 1, 2, 1, 1, 2, 3, 1, 2, 1, 2, 1, 1, 2, 1, 3, 1, 2, 1,
  ];
  let x = 2;
  const rects = bars.map((w, i) => {
    const cx = x;
    x += w + 1;
    return <rect key={i} x={cx} y={2} width={w} height={86} fill="#000" />;
  });
  const w = compact ? 48 : 72;
  const h = compact ? 64 : 100;
  return (
    <svg width={w} height={h} viewBox="0 0 72 100" className="receipt-barcode-svg" aria-hidden style={{ display: 'block' }}>
      {rects}
    </svg>
  );
}

function buildPrintEmbeddedStyles(p: PaperPreset): string {
  const c = p.cols;
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
    margin: ${p.pageMarginMm}mm;
  }
  @media print {
    html, body {
      width: ${p.innerW}mm;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print {
      display: none !important;
    }
    .receipt-print-root {
      width: ${p.innerW}mm !important;
      max-width: ${p.innerW}mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    .receipt-paper-page {
      display: flex !important;
      flex-direction: column !important;
      width: ${p.innerW}mm !important;
      min-height: ${p.minPageBodyH}mm !important;
      box-sizing: border-box !important;
      page-break-after: always !important;
      break-after: page !important;
    }
    .receipt-paper-page:last-child {
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
      width: ${p.innerW}mm !important;
      max-width: ${p.innerW}mm !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }
    .receipt-print-table th,
    .receipt-print-table td {
      border: 1px solid #000 !important;
      padding: ${p.printCellPaddingPx}px !important;
      font-size: ${p.printFontPx}px !important;
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
    }
    .receipt-print-table thead th {
      font-weight: bold !important;
      text-align: center !important;
      background-color: #fff !important;
    }
    .receipt-body-row td {
      height: ${p.rowHeightMm}mm !important;
    }
    .receipt-col-no { width: ${c.no}mm !important; }
    .receipt-col-name { width: ${c.name}mm !important; }
    .receipt-col-code { width: ${c.code}mm !important; }
    .receipt-col-unit { width: ${c.unit}mm !important; }
    .receipt-col-qty { width: ${c.qty}mm !important; }
    .receipt-col-price { width: ${c.price}mm !important; }
    .receipt-col-total { width: ${c.total}mm !important; }
  }
  @media screen {
    .receipt-paper-page {
      width: ${p.sheetW}mm;
      max-width: min(${p.sheetW}mm, calc(100vw - 24px));
      min-height: ${p.sheetH}mm;
      box-sizing: border-box;
      margin: 0 auto 16px;
      padding: ${p.id === 'a6' ? '4mm' : '8mm'};
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
}

export default function OrderReceipt({ order }: OrderReceiptProps) {
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [receiptPage, setReceiptPage] = useState(1);
  const [paperFormat, setPaperFormat] = useState<PaperFormat>('a4');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pngLoading, setPngLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  const preset = PAPER_PRESETS[paperFormat];
  const items = order.items || [];
  const chunks = useMemo(() => chunkOrderItems(items, preset.rowsPerPage), [items, preset.rowsPerPage]);
  const totalPages = chunks.length;
  const barcodeLabel = useMemo(() => formatBarcodeDigits(order.orderCode), [order.orderCode]);

  useEffect(() => {
    setReceiptPage(1);
  }, [order._id]);

  useEffect(() => {
    setReceiptPage(1);
  }, [paperFormat]);

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

  const handlePrint = async () => {
    if (!receiptRef.current || typeof window === 'undefined' || printLoading) return;
    setPrintLoading(true);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const styles = buildPrintEmbeddedStyles(preset);
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=${preset.viewport}, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
              <title>Захиалгын баримт - ${order.orderCode || order._id}</title>
              <style>${styles}</style>
            </head>
            <body>
              ${receiptRef.current.innerHTML}
            </body>
          </html>
        `);
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

  const handleDownloadPDF = async () => {
    if (typeof window === 'undefined' || isGenerating) return;

    const el = document.getElementById('receipt-preview');
    if (!el) {
      toast({ title: 'PDF үүсгэхэд алдаа гарлаа', variant: 'destructive' });
      return;
    }

    const pageEls = Array.from(el.querySelectorAll<HTMLElement>('.receipt-paper-page'));
    const prevPageDisplays = pageEls.map((p) => p.style.display);
    const prevWidth = el.style.width;
    const prevMinHeight = el.style.minHeight;

    setIsGenerating(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      pageEls.forEach((p) => {
        p.style.display = 'flex';
      });
      el.style.width = '794px';
      el.style.minHeight = '1123px';

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      try {
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ]);

        const captureHeight = Math.max(1, Math.ceil(el.scrollHeight));
        const canvas = await (html2canvas as (node: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>)(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: 794,
          height: captureHeight,
          windowWidth: 794,
        });

        if (!canvas.width || !canvas.height || !Number.isFinite(canvas.height)) {
          toast({ title: 'PDF үүсгэхэд алдаа гарлаа', variant: 'destructive' });
          return;
        }

        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pngData = canvas.toDataURL('image/png');
        doc.addImage(pngData, 'PNG', 0, 0, imgWidth, imgHeight);

        if (imgHeight > 297) {
          let heightLeft = imgHeight - 297;
          let position = -297;
          while (heightLeft > 0) {
            doc.addPage();
            doc.addImage(pngData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= 297;
            position -= 297;
          }
        }

        const orderCode = String(order.orderCode || order._id);
        doc.save(`receipt-${orderCode}.pdf`);
      } catch (err) {
        console.error('PDF generation failed:', err);
        toast({ title: 'PDF үүсгэхэд алдаа гарлаа', variant: 'destructive' });
      } finally {
        pageEls.forEach((p, i) => {
          p.style.display = prevPageDisplays[i];
        });
        el.style.width = prevWidth;
        el.style.minHeight = prevMinHeight;
      }
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast({ title: 'PDF үүсгэхэд алдаа гарлаа', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (!receiptRef.current || typeof window === 'undefined' || pngLoading) return;
    setPngLoading(true);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      const { default: html2canvas } = await import('html2canvas');
      const pageEls = Array.from(receiptRef.current.querySelectorAll<HTMLElement>('.receipt-paper-page'));
      if (pageEls.length === 0) return;

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
        await withSinglePageVisible(pageEls, i, async (el) => {
          const prevW = el.style.width;
          const prevH = el.style.height;
          const prevBox = el.style.boxSizing;
          try {
            applyCapturePixelBox(el, preset.sheetW, preset.sheetH);
            await doubleRaf();

            const canvas = await (html2canvas as (node: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>)(
              el,
              {
                scale: 2,
                useCORS: true,
                logging: false,
              }
            );

            if (!isValidCanvasSize(canvas)) {
              console.error('OrderReceipt PNG: invalid canvas dimensions');
              return;
            }

            const dataUrl = canvas.toDataURL('image/png');
            const filename =
              pageEls.length > 1 ? `${baseName}_хуудас${i + 1}.png` : `${baseName}.png`;
            triggerDownload(dataUrl, filename);
          } catch (e) {
            console.error('OrderReceipt PNG: ' + (e instanceof Error ? e.message : String(e)));
          } finally {
            el.style.width = prevW;
            el.style.height = prevH;
            el.style.boxSizing = prevBox;
          }
        });
        if (i < pageEls.length - 1) {
          await doubleRaf();
        }
      }
    } catch (e) {
      console.error('OrderReceipt PNG: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPngLoading(false);
    }
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
    <div className="receipt-sheet-top" style={{ width: '100%' }}>
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
        <div style={{ textAlign: 'right', maxWidth: `${preset.legalNoteMaxMm}mm`, lineHeight: 1.35 }}>
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
      className="footer receipt-sheet-footer"
      style={{
        marginTop: '10mm',
        paddingTop: '4mm',
        fontSize: `${preset.footerFontPx}px`,
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
        <div style={{ width: `${preset.stampMm + 4}mm`, flexShrink: 0, alignSelf: 'flex-end' }}>
          <div style={{ fontSize: `${preset.signatureFontPx}px`, marginBottom: '4px' }}>Тэмдэг</div>
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

        <div style={{ width: `${preset.barcodeWmm}mm`, flexShrink: 0, textAlign: 'center', alignSelf: 'flex-end' }}>
          <ReceiptBarcodeVisual compact={preset.id !== 'a4'} />
          <div
            style={{
              fontSize: preset.id === 'a6' ? '5px' : '8px',
              letterSpacing: '0.04em',
              marginTop: '4px',
              fontFamily: 'Arial, Helvetica, monospace',
            }}
          >
            {barcodeLabel}
          </div>
        </div>
      </div>
    </div>
  );

  const cellBorder: CSSProperties = {
    border: '1px solid #000',
    padding: preset.id === 'a6' ? '2px' : '3px',
    fontSize: preset.id === 'a6' ? '7px' : '9px',
  };

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
        id="receipt-preview"
        ref={receiptRef}
        data-paper={paperFormat}
        className={cn(
          'receipt-print-root receipt-container bg-white w-full mx-auto px-2 sm:px-0',
          paperFormat === 'a4' && 'max-w-[210mm]',
          paperFormat === 'a5' && 'max-w-[148mm]',
          paperFormat === 'a6' && 'max-w-[105mm]'
        )}
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          width: `min(${preset.sheetW}mm, 100%)`,
          maxWidth: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {chunks.map((chunk, pageIndex) => {
          const rows = preset.rowsPerPage;
          const startIdx = pageIndex * rows;
          const isLastPage = pageIndex === chunks.length - 1;
          const emptyRows = Math.max(0, rows - chunk.length);
          const visibleOnScreen = receiptPage === pageIndex + 1;

          return (
            <div
              key={`${paperFormat}-${pageIndex}`}
              className="receipt-paper-page"
              style={{
                display: visibleOnScreen ? 'flex' : 'none',
                flexDirection: 'column',
                minHeight: `${preset.sheetH}mm`,
                width: `min(${preset.sheetW}mm, calc(100vw - 16px))`,
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
                    width: `${preset.innerW}mm`,
                    maxWidth: '100%',
                    borderCollapse: 'collapse',
                    margin: '8px 0 0',
                    fontSize: preset.id === 'a6' ? '7px' : '9px',
                    border: '1px solid #000',
                    tableLayout: 'fixed',
                  }}
                >
                  <colgroup>
                    <col className="receipt-col-no" style={{ width: `${preset.cols.no}mm` }} />
                    <col className="receipt-col-name" style={{ width: `${preset.cols.name}mm` }} />
                    <col className="receipt-col-code" style={{ width: `${preset.cols.code}mm` }} />
                    <col className="receipt-col-unit" style={{ width: `${preset.cols.unit}mm` }} />
                    <col className="receipt-col-qty" style={{ width: `${preset.cols.qty}mm` }} />
                    <col className="receipt-col-price" style={{ width: `${preset.cols.price}mm` }} />
                    <col className="receipt-col-total" style={{ width: `${preset.cols.total}mm` }} />
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
                        <td
                          style={{
                            ...cellBorder,
                            textAlign: 'right',
                            fontWeight: 'bold',
                            fontSize: `${preset.totalRowFontPx}px`,
                          }}
                        >
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
