// export-word-correspondence.js
// سكريبت لتصدير المراسلات إلى Word

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        AlignmentType, HeadingLevel, BorderStyle, WidthType, Header } = require('docx');
const fs = require('fs');

async function createCorrespondenceWord(data) {
    const {
        subject,
        content,
        date,
        priority,
        department,
        signatures = []
    } = data;
    
    // تحديد الأولوية بالعربي
    const priorityMap = {
        'normal': 'عادي',
        'urgent': 'عاجل',
        'very_urgent': 'عاجل جداً'
    };
    
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    // A4 size
                    width: 11906,
                    height: 16838,
                    margin: {
                        top: 1440,    // 2.5cm
                        right: 1134,  // 2cm
                        bottom: 1134, // 2cm
                        left: 1134    // 2cm
                    }
                }
            },
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({
                                    text: "الجمهورية العراقية",
                                    bold: true,
                                    size: 32,
                                    font: "Arial"
                                })
                            ]
                        }),
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({
                                    text: "وزارة التربية",
                                    bold: true,
                                    size: 28,
                                    font: "Arial"
                                })
                            ]
                        }),
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({
                                    text: department || "قسم المالية",
                                    bold: true,
                                    size: 24,
                                    font: "Arial"
                                })
                            ]
                        }),
                        new Paragraph({
                            border: {
                                bottom: {
                                    color: "000000",
                                    space: 1,
                                    value: "double",
                                    size: 6
                                }
                            },
                            spacing: { after: 200 }
                        })
                    ]
                })
            },
            children: [
                // معلومات المراسلة
                new Paragraph({
                    spacing: { before: 200, after: 200 },
                    children: []
                }),
                
                // جدول المعلومات
                new Table({
                    width: {
                        size: 100,
                        type: WidthType.PERCENTAGE
                    },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 25, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.RIGHT,
                                            children: [
                                                new TextRun({
                                                    text: "العدد:",
                                                    bold: true,
                                                    font: "Arial"
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new TableCell({
                                    width: { size: 25, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.RIGHT,
                                            children: [
                                                new TextRun({
                                                    text: "____________",
                                                    font: "Arial"
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new TableCell({
                                    width: { size: 25, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.RIGHT,
                                            children: [
                                                new TextRun({
                                                    text: "التاريخ:",
                                                    bold: true,
                                                    font: "Arial"
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new TableCell({
                                    width: { size: 25, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.RIGHT,
                                            children: [
                                                new TextRun({
                                                    text: date || new Date().toLocaleDateString('ar-IQ'),
                                                    font: "Arial"
                                                })
                                            ]
                                        })
                                    ]
                                })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.RIGHT,
                                            children: [
                                                new TextRun({
                                                    text: "الموضوع:",
                                                    bold: true,
                                                    font: "Arial"
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new TableCell({
                                    columnSpan: 2,
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.RIGHT,
                                            children: [
                                                new TextRun({
                                                    text: subject || "",
                                                    font: "Arial"
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new TableCell({
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.RIGHT,
                                            children: [
                                                new TextRun({
                                                    text: "الأولوية:",
                                                    bold: true,
                                                    font: "Arial"
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new TableCell({
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.RIGHT,
                                            children: [
                                                new TextRun({
                                                    text: priorityMap[priority] || 'عادي',
                                                    font: "Arial",
                                                    bold: priority === 'urgent' || priority === 'very_urgent'
                                                })
                                            ]
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                }),
                
                // المحتوى
                new Paragraph({
                    spacing: { before: 300, after: 300 },
                    children: []
                }),
                
                ...content.split('\n').map(line => 
                    new Paragraph({
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: { line: 360 },
                        children: [
                            new TextRun({
                                text: line,
                                font: "Arial",
                                size: 24
                            })
                        ]
                    })
                ),
                
                // التوقيعات
                new Paragraph({
                    spacing: { before: 400 },
                    children: []
                }),
                
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                        new TextRun({
                            text: "سلسلة التوقيعات:",
                            bold: true,
                            font: "Arial",
                            size: 24
                        })
                    ]
                }),
                
                new Paragraph({
                    spacing: { before: 200 },
                    children: []
                }),
                
                // جدول التوقيعات
                new Table({
                    width: {
                        size: 100,
                        type: WidthType.PERCENTAGE
                    },
                    rows: signatures.map((sig, index) => 
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 33, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            children: [
                                                new TextRun({
                                                    text: sig.role || "",
                                                    bold: true,
                                                    font: "Arial"
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new TableCell({
                                    width: { size: 33, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            children: [
                                                new TextRun({
                                                    text: sig.name || "",
                                                    font: "Arial"
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new TableCell({
                                    width: { size: 34, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            spacing: { before: 400, after: 100 },
                                            children: [
                                                new TextRun({
                                                    text: sig.final ? "(التوقيع والختم)" : "(التوقيع)",
                                                    font: "Arial",
                                                    size: 20
                                                })
                                            ]
                                        }),
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            children: [
                                                new TextRun({
                                                    text: "التاريخ: __ / __ / ____",
                                                    font: "Arial",
                                                    size: 18
                                                })
                                            ]
                                        })
                                    ]
                                })
                            ]
                        })
                    )
                }),
                
                // الهامش
                new Paragraph({
                    spacing: { before: 600 },
                    border: {
                        top: {
                            color: "CCCCCC",
                            space: 1,
                            value: "single",
                            size: 6
                        }
                    },
                    children: []
                }),
                
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 100 },
                    children: [
                        new TextRun({
                            text: "العراق - بغداد - شارع الرشيد",
                            font: "Arial",
                            size: 20
                        })
                    ]
                }),
                
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: "📞 07XX XXX XXXX | 📧 info@moe.gov.iq",
                            font: "Arial",
                            size: 20
                        })
                    ]
                })
            ]
        }]
    });
    
    return doc;
}

module.exports = { createCorrespondenceWord };
