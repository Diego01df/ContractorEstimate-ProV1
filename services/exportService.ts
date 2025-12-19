
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, BorderStyle, ImageRun } from 'docx';
import { Project, LineItem, CATEGORY_DESCRIPTIONS, PAYMENT_TERMS } from '../types';

// Helper to calculate totals including internal ECO Profit
const calcLine = (item: LineItem) => {
    const base = (item.quantity * item.unitPrice) + (item.quantity * (item.laborRate || 0));
    const profit = base * ((item.ecoProfit || 0) / 100);
    return base + profit + (item.markup || 0);
};

const formatMoney = (n: number) => `$${n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

export const exportPDF = (project: Project) => {
    const doc = new jsPDF();
    
    // Modern Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text("Estimate Report", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Project: ${project.title}`, 14, 30);
    doc.text(`Address: ${project.address.street}, ${project.address.city}, ${project.address.state} ${project.address.zip}`, 14, 35);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 40);

    let finalY = 50;
    let projectSubtotal = 0;

    project.rooms.forEach(room => {
        let roomTotal = 0;
        const bodyData = room.items.map(item => {
            const total = calcLine(item);
            roomTotal += total;
            
            const displayDescription = item.description || CATEGORY_DESCRIPTIONS[item.category] || item.category;

            return [
                item.category,
                displayDescription,
                item.paymentDue,
                formatMoney(total)
            ];
        });
        projectSubtotal += roomTotal;

        if (finalY > 230) {
            doc.addPage();
            finalY = 20;
        }

        // Room Header with Image
        if (room.photo) {
            try {
                doc.addImage(room.photo, 'JPEG', 14, finalY, 20, 20);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(14);
                doc.setTextColor(15, 23, 42);
                doc.text(room.name, 38, finalY + 12);
                finalY += 25;
            } catch (e) {
                console.warn("PDF addImage failed", e);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(14);
                doc.setTextColor(15, 23, 42);
                doc.text(room.name, 14, finalY + 10);
                finalY += 15;
            }
        } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(room.name, 14, finalY + 10);
            finalY += 15;
        }
        
        autoTable(doc, {
            startY: finalY,
            head: [['Category', 'Description', 'Payment Due', 'Total (USD)']],
            body: bodyData,
            foot: [['', '', 'Subtotal', formatMoney(roomTotal)]],
            theme: 'grid',
            headStyles: { 
                fillColor: [241, 245, 249], 
                textColor: [71, 85, 105], 
                fontStyle: 'bold',
                lineWidth: 0
            },
            footStyles: {
                fillColor: [255, 255, 255],
                textColor: [15, 23, 42],
                fontStyle: 'bold',
                halign: 'right'
            },
            styles: {
                textColor: [51, 65, 85], 
                fontSize: 9,
                cellPadding: 3,
                valign: 'top'
            },
            columnStyles: {
                0: { cellWidth: 35 }, 
                1: { cellWidth: 'auto' }, 
                2: { cellWidth: 35, halign: 'left' }, 
                3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } 
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250]
            }
        });

        // @ts-ignore
        finalY = doc.lastAutoTable.finalY + 10;
    });

    const contingency = projectSubtotal * ((project.contingencyPct || 0) / 100);
    const tax = (projectSubtotal + contingency) * (project.taxPct / 100);
    const gross = projectSubtotal + contingency + tax;
    const discount = gross * ((project.discountPct || 0) / 100);
    const grandTotal = gross - discount;

    if (finalY > 240) {
        doc.addPage();
        finalY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Summary", 14, finalY + 5);
    
    const summaryBody = [];
    if ((project.contingencyPct || 0) > 0) {
        summaryBody.push([`Contingency (${project.contingencyPct || 0}%)`, formatMoney(contingency)]);
    }
    summaryBody.push(['Estimated Tax', formatMoney(tax)]);
    summaryBody.push(['Grand Total Estimate:', formatMoney(gross)]);
    
    if (discount > 0) {
        summaryBody.push([`Discount (${project.discountPct || 0}%)`, `-${formatMoney(discount)}`]);
        summaryBody.push(['Final Adjusted Total', formatMoney(grandTotal)]);
    }

    autoTable(doc, {
        startY: finalY + 10,
        body: summaryBody,
        theme: 'plain',
        styles: { fontSize: 11, cellPadding: 3 },
        columnStyles: { 
            0: { fontStyle: 'bold', textColor: [71, 85, 105] }, 
            1: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] } 
        }
    });

    doc.save(`${project.title.replace(/\s+/g, '_')}_estimate.pdf`);
};

export const exportExcel = (project: Project) => {
    const wb = XLSX.utils.book_new();
    
    let projectSubtotal = 0;
    const summaryData = [
        ["Project Title", project.title],
        ["Address", `${project.address.street}, ${project.address.city}, ${project.address.zip}`],
        ["Date", new Date().toLocaleDateString()],
        [],
        ["Room", "Subtotal"]
    ];

    project.rooms.forEach(room => {
        let roomTotal = 0;
        room.items.forEach(i => roomTotal += calcLine(i));
        projectSubtotal += roomTotal;
        summaryData.push([room.name, String(roomTotal)]);
    });

    const contingency = projectSubtotal * ((project.contingencyPct || 0) / 100);
    const tax = (projectSubtotal + contingency) * (project.taxPct / 100);
    const gross = projectSubtotal + contingency + tax;
    const discount = gross * ((project.discountPct || 0) / 100);
    const grandTotal = gross - discount;

    summaryData.push([]);
    if ((project.contingencyPct || 0) > 0) {
        summaryData.push([`Contingency (${project.contingencyPct || 0}%)`, String(contingency)]);
    }
    summaryData.push(["Tax", String(tax)]);
    summaryData.push(["Grand Total Estimate", String(gross)]);
    
    if (discount > 0) {
        summaryData.push([`Discount (${project.discountPct || 0}%)`, `-${String(discount)}`]);
        summaryData.push(["Final Total", String(grandTotal)]);
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const detailHeader = ["Room", "Category", "Description", "Payment Due", "Total (USD)"];
    const detailData: (string | number)[][] = [];

    project.rooms.forEach(room => {
        let roomTotal = 0;
        room.items.forEach(item => {
            const total = calcLine(item);
            roomTotal += total;
            const displayDescription = item.description || CATEGORY_DESCRIPTIONS[item.category] || item.category;

            detailData.push([
                room.name,
                item.category,
                displayDescription,
                item.paymentDue,
                total
            ]);
        });
        detailData.push(["", "", "", `${room.name} Subtotal`, roomTotal]);
        detailData.push([]); 
    });

    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailData]);
    XLSX.utils.book_append_sheet(wb, wsDetail, "Details");

    XLSX.writeFile(wb, `${project.title.replace(/\s+/g, '_')}_estimate.xlsx`);
};

export const exportWord = async (project: Project) => {
    let projectSubtotal = 0;
    const children: any[] = [];

    children.push(
        new Paragraph({
            text: "Estimate Report",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "Project: ", bold: true }),
                new TextRun({ text: project.title }),
                new TextRun({ text: "\nAddress: ", bold: true, break: 1 }),
                new TextRun({ text: `${project.address.street}, ${project.address.city}, ${project.address.state} ${project.address.zip}` }),
                new TextRun({ text: "\nDate: ", bold: true, break: 1 }),
                new TextRun({ text: new Date().toLocaleDateString() }),
            ],
            spacing: { after: 400 }
        })
    );

    for (const room of project.rooms) {
        let roomTotal = 0;

        const roomParaChildren = [];
        if (room.photo) {
             const base64Data = room.photo.split(',')[1];
             // Fix for docx ImageRun options type error by casting to any
             roomParaChildren.push(
                new ImageRun({
                    data: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)),
                    transformation: { width: 60, height: 60 },
                } as any),
                new TextRun({ text: "  ", size: 32 })
             );
        }
        roomParaChildren.push(new TextRun({ text: room.name, bold: true, size: 28 }));

        children.push(
            new Paragraph({
                children: roomParaChildren,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 100 },
                border: { bottom: { color: "cccccc", space: 1, style: BorderStyle.SINGLE, size: 6 } }
            })
        );

        const headerRow = new TableRow({
            children: ["Category", "Description", "Payment Due", "Total (USD)"].map(t => 
                new TableCell({
                    children: [new Paragraph({ text: t, style: "strong" })],
                    shading: { fill: "f1f5f9" },
                    verticalAlign: AlignmentType.CENTER,
                })
            )
        });

        const rows = [headerRow];

        room.items.forEach(item => {
            const total = calcLine(item);
            roomTotal += total;
            
            const displayDescription = item.description || CATEGORY_DESCRIPTIONS[item.category] || item.category;

            rows.push(new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.category, size: 16 })] })] }), 
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: displayDescription, size: 16 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.paymentDue, size: 16 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMoney(total), bold: true, size: 16 })] })] }),
                ]
            }));
        });

        rows.push(new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({})] }), 
                new TableCell({ children: [new Paragraph({})] }), 
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Subtotal", bold: true, size: 16 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMoney(roomTotal), bold: true, size: 16 })] })] }),
            ]
        }));

        projectSubtotal += roomTotal;

        children.push(
            new Table({
                rows: rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
            })
        );
    }

    const contingency = projectSubtotal * ((project.contingencyPct || 0) / 100);
    const tax = (projectSubtotal + contingency) * (project.taxPct / 100);
    const gross = projectSubtotal + contingency + tax;
    const discount = gross * ((project.discountPct || 0) / 100);
    const grandTotal = gross - discount;

    children.push(new Paragraph({ text: "", spacing: { before: 400 } })); 
    children.push(new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }));

    const summaryRows = [];
    if ((project.contingencyPct || 0) > 0) {
        summaryRows.push(
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Contingency (${project.contingencyPct || 0}%)`, bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMoney(contingency) })] })] })
                ]
            })
        );
    }
    summaryRows.push(
        new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Estimated Tax", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMoney(tax) })] })] })
            ]
        })
    );
    
    summaryRows.push(
        new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Grand Total Estimate:", bold: true, size: 24 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMoney(gross), bold: true, size: 24 })] })] })
            ]
        })
    );

    if (discount > 0) {
        summaryRows.push(
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Discount (${project.discountPct}%)`, bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `-${formatMoney(discount)}` })] })] })
                ]
            })
        );
        summaryRows.push(
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Final Adjusted Total", bold: true, size: 24 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMoney(grandTotal), bold: true, size: 24 })] })] })
                ]
            })
        );
    }

    children.push(
        new Table({
            rows: summaryRows,
            width: { size: 60, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.RIGHT
        })
    );

    const doc = new Document({
        sections: [{ children }]
    });

    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_estimate.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
};
