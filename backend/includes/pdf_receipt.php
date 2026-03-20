<?php
require_once __DIR__ . '/tcpdf/tcpdf.php';

function createBookingReceiptPdf(array $appointment)
{
    $pdf = new TCPDF();
    $pdf->SetCreator('CarePlus Hospital');
    $pdf->SetAuthor('CarePlus Hospital');
    $pdf->SetTitle('Appointment Booking Receipt');

    $pdf->SetMargins(15, 20, 15);
    $pdf->AddPage();

    /*
    -------------------------------------
    WATERMARK
    -------------------------------------
    */ /*
    $pdf->SetAlpha(0.08);
    $pdf->StartTransform();
    $pdf->Rotate(45, 30, 180);

    $pdf->SetFont('helvetica', 'B', 60);
    $pdf->SetTextColor(0,102,204);
    $pdf->Text(30,180,'CAREPLUS HOSPITAL');

    $pdf->StopTransform();
    $pdf->SetAlpha(1);
    */

    /*
-------------------------------------
MAIN WATERMARK
-------------------------------------
*/

$pdf->SetAlpha(0.08);
$pdf->StartTransform();
$pdf->Rotate(45, 35, 190);

$pdf->SetFont('helvetica', 'B', 60);
$pdf->SetTextColor(0,102,204);
$pdf->Text(35,190,'CAREPLUS');

$pdf->StopTransform();
$pdf->SetAlpha(1);


/*
-------------------------------------
CANCELLED WATERMARK
-------------------------------------
*/

if(strtolower($appointment['status']) === 'cancelled'){

    $pdf->SetAlpha(0.25);

    $pdf->StartTransform();
    $pdf->Rotate(45, 40, 160);

    $pdf->SetFont('helvetica','B',70);
    $pdf->SetTextColor(220,0,0);

    $pdf->Text(40,160,'CANCELLED');

    $pdf->StopTransform();

    $pdf->SetAlpha(1);
}

//     /*
//     -------------------------------------
//     HEADER
//     -------------------------------------


// 1. Move to the top of the page
$pdf->SetY(15); 

// 2. Style the "CarePlus" Logo
// Font: Helvetica, Style: Bold (B), Size: 28
$pdf->SetFont('helvetica', 'B', 28); 

// Color: Brand Blue (Match your receipt)
$pdf->SetTextColor(0, 102, 204); 

// 3. Draw the Logo
// Parameters: Width (0 = full page), Height, Text, Border, Next Line, Align
$pdf->Cell(0, 12, 'CarePlus', 0, 1, 'C'); 

// 4. Add the Subtitle (Smaller & Grey)
$pdf->SetFont('helvetica', '', 12);
$pdf->SetTextColor(100, 100, 100); // Medium Grey
$pdf->Cell(0, 6, 'Hospital Appointment Receipt', 0, 1, 'C');

// 5. Add a decorative spacing
$pdf->Ln(10); 




    /*
    -------------------------------------
    QR CODE DATA
    -------------------------------------
    */

    $qrData = "CarePlus Appointment\n"
        ."Ref: ".$appointment['reference_no']."\n"
        ."Patient: ".$appointment['patient_name']."\n"
        ."Doctor: ".$appointment['doctor_name']."\n"
        ."Date: ".$appointment['appointment_date']."\n"
        ."Time: ".$appointment['time_slot'];

    $style = [
        'border' => 0,
        'padding' => 2,
        'fgcolor' => [0,0,0],
        'bgcolor' => false
    ];

    $pdf->write2DBarcode($qrData,'QRCODE,H',160,35,35,35,$style,'N');

    /*
    -------------------------------------
    TABLE DATA
    -------------------------------------
    */

    // $status = strtolower($appointment['status']);

    // $statusColor = "green";

    // if($status === "cancelled"){
    //     $statusColor = "red";
    // }

    $status = strtolower($appointment['status']);
    $statusColor = ($status === 'cancelled') ? 'red' : 'green';

    $html = '
    <style>
        table{
            border-collapse: collapse;
            width: 100%;
        }
        td{
            border:1px solid #ccc;
            padding:8px;
            font-size:12px;
        }
        .label{
            font-weight:bold;
            background:#f2f2f2;
            width:40%;
        }
        .status{
            color:green;
            font-weight:bold;
        }
    </style>

    <table>

        <tr>
            <td class="label">Reference ID</td>
            <td>'.$appointment['reference_no'].'</td>
        </tr>

        <tr>
            <td class="label">Patient Name</td>
            <td>'.$appointment['patient_name'].'</td>
        </tr>

        <tr>
            <td class="label">Phone Number</td>
            <td>'.$appointment['patient_phone'].'</td>
        </tr>

        <tr>
            <td class="label">Doctor</td>
            <td>'.$appointment['doctor_name'].'</td>
        </tr>

        <tr>
            <td class="label">Specialization</td>
            <td>'.$appointment['specialization'].'</td>
        </tr>

        <tr>
            <td class="label">Appointment Date</td>
            <td>'.$appointment['appointment_date'].'</td>
        </tr>

        <tr>
            <td class="label">Time Slot</td>
            <td>'.$appointment['time_slot'].'</td>
        </tr>

        <tr>
            <td class="label">Status</td>
            <td style="color:'.$statusColor.'; font-weight:bold;">
            '.$appointment['status'].'
            </td>
        </tr>

    </table>
    ';

    $pdf->writeHTML($html,true,false,true,false,'');

    $pdf->Ln(20);

    /*
    -------------------------------------
    FOOTER
    -------------------------------------
    */

    // $pdf->SetFont('helvetica','',10);
    // $pdf->SetTextColor(120,120,120);

    $pdf->MultiCell(
        0,
        6,
        "Please arrive 15 minutes before your appointment.\n"
        ."Bring this receipt or show the QR code at reception.\n\n"
        ."Generated on ".date("Y-m-d H:i:s"),
        0,
        'C'
    );

    /*
    -------------------------------------
    SAVE FILE
    -------------------------------------
    */

    $folder = __DIR__.'/../../assets/booking_documents/';

    if(!is_dir($folder)){
        mkdir($folder,0777,true);
    }

    $filename = 'receipt_'.$appointment['reference_no'].'.pdf';
    $path = $folder.$filename;

    $pdf->Output($path,'F');

    return 'assets/booking_documents/'.$filename;
}