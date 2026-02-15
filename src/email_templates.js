export const verificationLinkEmailContent = (link, unsubscribeUrl, isRegister) => {
    console.log('verificationLinkEmailContent is triggered');
    console.log('link: ', link);
    console.log('unsubscribeUrl: ', unsubscribeUrl);
    console.log('isRegister: ', isRegister);

    const html = `
    <!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>
</title>
 <style type="text/css">
table,td{border-collapse:collapse}img{height:auto;line-height:100%;outline:0}a,img{text-decoration:none}h1,h2,h3,h4,h5,p{line-height:1.5;margin:0 0 10px}ul>li{mso-special-format:bullet}h1,h2,h3,h4,h5{line-height:1.2;font-weight:400}h1{font-size:36px}h2{font-size:30px}h3{font-size:24px}h4{font-size:20px}h5,p{font-size:14px}hr{margin:0}th.social_element,th.tc{font-weight:400;text-align:left}td,th,tr{border-color:transparent}.content-cell{vertical-align:top}.content-cell table.social,.content-cell table.social table,.content-cell table.social td,.content-cell table.social th,.content-cell table.sp-button,.content-cell table.sp-button table,.content-cell table.sp-button td,.content-cell table.sp-button th,img{border:0}.content-cell table.social td,.content-cell table.social th,.content-cell table.sp-button td,.content-cell table.sp-button th{padding:0}.content-cell .sp-button table td,.content-cell table.social{line-height:1}.content-cell>center>.sp-button{margin-left:auto;margin-right:auto}.content-cell .social,.content-cell .social_element,.content-cell .sp-button-side-padding,.content-cell .sp-button-text{border-color:transparent;border-width:0;border-style:none}.content-cell .sp-button-side-padding{width:21px}.content-cell .sp-button-text a{text-decoration:none;display:block}.content-cell .sp-button-text a img,.sp-video img{max-width:100%}.content-cell em,.content-cell span[style*=color]>a,.email-text .data_text em,.email-text em,.email-wrapper span[style*=color]>a{color:inherit}.content-cell>div>.sp-img,.content-cell>div>a>.sp-img{margin:0}.content-cell .link_img,.content-cell table.social .social_element img.social,.social_element img.social,.sp-video a{display:block}.content-cell .sp-button-img td{display:table-cell!important;width:initial!important}.content-cell>p,.email-text .data_text>p,.email-text>p{line-height:inherit;color:inherit;font-size:inherit}.content-cell>table,.content-cell>table>tbody>tr>td,.content-cell>table>tbody>tr>th,.content-cell>table>tr>td,.content-cell>table>tr>th,.email-text .data_text>table,.email-text .data_text>table>tbody>tr>td,.email-text .data_text>table>tbody>tr>th,.email-text .data_text>table>tr>td,.email-text .data_text>table>tr>th,.email-text>table,.email-text>table>tbody>tr>td,.email-text>table>tbody>tr>th,.email-text>table>tr>td,.email-text>table>tr>th{border-color:#ddd;border-width:1px;border-style:solid}.content-cell>table td,.content-cell>table th,.email-text .data_text>table td,.email-text .data_text>table th,.email-text>table td,.email-text>table th{padding:3px}.content-cell table.social .social_element,.social_element{padding:2px 5px;font-size:13px;font-family:Arial,sans-serif;line-height:32px}.content-cell table.social .social_element_t_3 img.social,.content-cell table.social .social_element_t_4 img.social,.content-cell table.social .social_element_t_5 img.social,.content-cell table.social .social_element_v_i_t img.social{display:inline}.email-text table th{text-align:center}.email-text pre{background-color:transparent;border:0;color:inherit;padding:0;margin:1em 0}.sp-video a{overflow:auto}@media only screen and (max-width:640px){.sp-hidden-mob{display:none!important}}
a{color:#0089bf;}
body,.content-row,p,h1,h2,h3,h4,h5,h6,li{color:#444444;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;}
body,table,div,p,li{font-size:14px;line-height:1.5;}
</style>
<style type="text/css">
table,td{border-collapse:collapse}img{height:auto;line-height:100%;outline:0;-ms-interpolation-mode:bicubic}a,img{text-decoration:none}h1,h2,h3,h4,h5,p{line-height:1.5;margin:0 0 10px}ul>li{mso-special-format:bullet}h1,h2,h3,h4,h5{line-height:1.2;font-weight:400}h1{font-size:36px}h2{font-size:30px}h3{font-size:24px}h4{font-size:20px}h5,p{font-size:14px}hr{margin:0}th.social_element,th.tc{font-weight:400;text-align:left}td,th,tr{border-color:transparent}.content-cell{vertical-align:top}.content-cell table.social,.content-cell table.social table,.content-cell table.social td,.content-cell table.social th,.content-cell table.sp-button,.content-cell table.sp-button table,.content-cell table.sp-button td,.content-cell table.sp-button th,img{border:0}#outlook a,.content-cell table.social td,.content-cell table.social th,.content-cell table.sp-button td,.content-cell table.sp-button th{padding:0}.content-cell .sp-button table td,.content-cell table.social{line-height:1}.content-cell>center>.sp-button{margin-left:auto;margin-right:auto}.content-cell .social,.content-cell .social_element,.content-cell .sp-button-side-padding,.content-cell .sp-button-text{border-color:transparent;border-width:0;border-style:none}.content-cell .sp-button-side-padding{width:21px}.content-cell .sp-button-text a{text-decoration:none;display:block}.content-cell .sp-button-text a img,.sp-video img{max-width:100%}.content-cell em,.content-cell span[style*=color]>a,.email-text .data_text em,.email-text em,.email-wrapper span[style*=color]>a{color:inherit}.content-cell>div>.sp-img,.content-cell>div>a>.sp-img,body{margin:0}.content-cell .link_img,.content-cell table.social .social_element img.social,.social_element img.social,.sp-video a{display:block}.content-cell .sp-button-img td{display:table-cell!important;width:initial!important}.content-cell>p,.email-text .data_text>p,.email-text>p{line-height:inherit;color:inherit;font-size:inherit}.content-cell>table,.content-cell>table>tbody>tr>td,.content-cell>table>tbody>tr>th,.content-cell>table>tr>td,.content-cell>table>tr>th,.email-text .data_text>table,.email-text .data_text>table>tbody>tr>td,.email-text .data_text>table>tbody>tr>th,.email-text .data_text>table>tr>td,.email-text .data_text>table>tr>th,.email-text>table,.email-text>table>tbody>tr>td,.email-text>table>tbody>tr>th,.email-text>table>tr>td,.email-text>table>tr>th{border-color:#ddd;border-width:1px;border-style:solid}.content-cell>table td,.content-cell>table th,.email-text .data_text>table td,.email-text .data_text>table th,.email-text>table td,.email-text>table th{padding:3px}.content-cell table.social .social_element,.social_element{padding:2px 5px;font-size:13px;font-family:Arial,sans-serif;line-height:32px}.content-cell table.social .social_element_t_3 img.social,.content-cell table.social .social_element_t_4 img.social,.content-cell table.social .social_element_t_5 img.social,.content-cell table.social .social_element_v_i_t img.social{display:inline}.email-text table th{text-align:center}.email-text pre{background-color:transparent;border:0;color:inherit;padding:0;margin:1em 0}.sp-video a{overflow:auto}@media only screen and (max-width:640px){.sp-hidden-mob{display:none!important} }body{padding:0}*{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0;mso-table-rspace:0}.ExternalClass,.ReadMsgBody{width:100%}.ExternalClass *{line-height:100%}table{margin-bottom:0!important;border-color:transparent}u~div .gmail-hide{display:none}u~div .gmail-show{display:block!important}@media yahoo {.yahoo-hide{display:none}.yahoo-show{display:block!important} }.im{color:inherit!important}td[class^=xfmc]{width:inherit!important}@media only screen and (max-width:640px){.wrapper-table{min-width:296px}.sp-demo-label-link{display:block}td,th{margin-bottom:0;height:inherit!important}td.content-cell,th.content-cell{padding:15px!important}table.email-checkout.email-checkout-yandex,td.content-cell .social,th.content-cell .social{width:auto!important}td.content-cell .share th,td.content-cell .social td .share td,td.content-cell .social th,th.content-cell .share th,th.content-cell .social td .share td,th.content-cell .social th{display:inline-block!important}td,td.content-cell .share th.social_element_t_3,td.content-cell .share th.social_element_t_4,td.content-cell .social td .share td.social_element_t_3,td.content-cell .social td .share td.social_element_t_4,td.content-cell .social th.social_element_t_3,td.content-cell .social th.social_element_t_4,th,th.content-cell .share th.social_element_t_3,th.content-cell .share th.social_element_t_4,th.content-cell .social td .share td.social_element_t_3,th.content-cell .social td .share td.social_element_t_4,th.content-cell .social th.social_element_t_3,th.content-cell .social th.social_element_t_4{display:block!important}td.content-cell .share th a>img,td.content-cell .social td .share td a>img,td.content-cell .social th a>img,th.content-cell .share th a>img,th.content-cell .social td .share td a>img,th.content-cell .social th a>img{width:32px!important;height:32px!important}td.content-cell>td,th.content-cell>td{width:100%}td.content-cell>p,th.content-cell>p{width:100%!important}td.content-cell.padding-lr-0,th.content-cell.padding-lr-0{padding-left:0!important;padding-right:0!important}td.content-cell.padding-top-0,th.content-cell.padding-top-0{padding-top:0!important}td.content-cell.padding-bottom-0,th.content-cell.padding-bottom-0{padding-bottom:0!important}.sp-video{padding-left:15px!important;padding-right:15px!important}.wrapper-table>tbody>tr>td{padding:0}.block-divider{padding:2px 15px!important}.social_share{width:16px!important;height:16px!important}.sp-button td{display:table-cell!important;width:initial!important}.sp-button td.sp-button-side-padding{width:21px!important}input{max-width:100%!important}table{border-width:1px}.tc{width:100%!important}.inline-item,table.smallImg td.smallImg{display:inline!important}table.origin-table{width:95%!important}table.origin-table td{display:table-cell!important;padding:0!important}.p100_img{width:100%!important;max-width:100%!important;height:auto!important}table.social{width:initial!important} }@media only screen and (max-width:640px) and screen and (-ms-high-contrast:active),only screen and (max-width:640px) and (-ms-high-contrast:none){td,th{float:left;width:100%;clear:both}.content-cell img,img:not(.p100_img){width:auto;height:auto;max-width:269px!important;margin-right:auto;display:block!important;margin-left:auto} }.content-cell{word-break:break-word}.content-cell *{-webkit-box-sizing:border-box;box-sizing:border-box}.rollover{font-size:0}@media only screen and (max-width:640px){.rollover img.sp-img.desktop,.rollover img.sp-img.desktop.rollover-first,.rollover img.sp-img.desktop.rollover-second,img.sp-img.desktop{display:none!important}img.sp-img.mobile{display:block!important} }@media only screen and (min-width:641px){.rollover img.sp-img.mobile,.rollover img.sp-img.mobile.rollover-first,.rollover img.sp-img.mobile.rollover-second{display:none!important} }
.rollover:hover .desktop.rollover-first,
.rollover:hover .mobile.rollover-first{
    max-height: 0 !important;
    display: none !important;
}
.rollover .desktop.rollover-second,
.rollover .mobile.rollover-second {
    max-height: 0 !important;
    display: none !important;
}
.rollover:hover .desktop.rollover-second,
.rollover:hover .mobile.rollover-second {
    max-height: none !important;
    display: block !important;
    object-fit: cover;
}
td.content-cell .social th{
  display: inline-block !important;
}
@media only screen and (max-width:640px){
    table {
        width: 100% !important;
    }
    table,hr {
        width: 100%;
        max-width: 100% !important;
    }
    td,div {
        width: 100% !important;
        height: auto !important;
        box-sizing: border-box;
    }
    td,th {
        display: block !important;
        margin-bottom: 0;
        height: inherit !important;
    }
}
</style>
</head>
<body style="margin:0">
<div style="background-color: #eeeeee;">
<table class="wrapper-table" cellpadding="5" cellspacing="0" width="100%" border="0" style="background-repeat:no-repeat;background-position:left top;" background="https://s8053915.sendpul.se/image" >
<!--[if gte mso 9]>
<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
<v:fill type="frame" color="#eeeeee"/>
        </v:background>
        <![endif]-->
        <tr>
        <td align="center">
        <table cellpadding="0" cellspacing="0" width="600px" id="bodyTable" border="0" bgcolor="#ffffff">
        <tr>
        <td border="0" cellpadding="0" cellspacing="0">
        <table  cellpadding="0" cellspacing="0" style="width:100%;" border="0">
        <tr>
        <td  style="padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;vertical-align:top;"  border="0" cellpadding="0" cellspacing="0">
        <table cellpadding="0" cellspacing="0" style="width:100%;" border="0">
        <tr>
        <th width="600" style="vertical-align:top" cellpadding="0" cellspacing="0" class="tc responsive ">
        <table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
        <tr>
        <td cellpadding="0" cellspacing="0" style="vertical-align: top;">
        <table width="100%" cellpadding="0" cellspacing="0" id="wout_block_2_element_0" style="background-color:#eeeeee;border-collapse:separate;overflow:hidden;">
        <tr class="content-row">
        <td class="content-cell padding-lr-0 padding-top-0 padding-bottom-0" width="600" style="padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;" >
        <div id="wout_block_2_element_0" style="width:100%;height:57;display:block;">
        <img border="0" width="300" height="57" class="desktop  sp-img small_img " align="left" alt="Oyabun_Logo" src="https://s8053915.sendpul.se/files/emailservice/userfiles/708c67d0048fb91029d1237653e73fd78053915/Untitled_design.png"iout_block_2_element_0 style="display:block;-ms-interpolation-mode:bicubic;"/>
        <!--[if !mso]>
        <!-->
        <div style="mso-hide:all;">
        <img border="0" width="300" height="57" class="mobile  sp-img small_img " align="left" alt="Oyabun_Logo" src="https://s8053915.sendpul.se/files/emailservice/userfiles/708c67d0048fb91029d1237653e73fd78053915/Untitled_design.png"iout_block_2_element_0 style="display:block;-ms-interpolation-mode:bicubic;display:none;width:100%; max-width:100% !important;"/>
        </div>
        <!--<![endif]-->
        </div>
        <div style="clear: both">
        </div>
        </td>
        </tr>
        </table>
        </td>
        </tr>
        </table>
        <table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
        <tr>
        <td cellpadding="0" cellspacing="0" style="vertical-align: top;">
        <table class="separator" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; background-color:#eeeeee;padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;height:20px;">
        <tr>
        <td height="20">
        </td>
        </tr>
        </table>
        </td>
        </tr>
        </table>
        </th>
        </tr>
        </table>
        </td>
        </tr>
        </table>
        <table  cellpadding="0" cellspacing="0" style="width:100%;" border="0">
        <tr>
        <td  style="padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;vertical-align:top;"  border="0" cellpadding="0" cellspacing="0">
        <table cellpadding="0" cellspacing="0" style="width:100%;" border="0">
        <tr>
        <th width="600" style="vertical-align:top" cellpadding="0" cellspacing="0" class="tc responsive ">
        <table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
        <tr>
        <td cellpadding="0" cellspacing="0" style="vertical-align: top;">
        <table width="100%" cellpadding="0" cellspacing="0" id="wout_block_out_block_5" style="text-color:black;background-color:transparent;font-weight:normal;color:#333333;margin:0;border-collapse:separate;overflow:hidden;">
        <tr class="content-row">
        <td class="content-cell padding-bottom-0" width="540" style="padding-left:30px;padding-right:30px;padding-top:20px;padding-bottom:0px;" >
        <h4 style="font-weight:normal;color:#333333;">
        <span>ElasticDash to elasticdash! </span>
        </h4>
<p style="font-weight:normal;color:#333333;padding:0;">
<span>We're thrilled to have you on board. To ensure the security of your account and start exploring job opportunities, please verify your email address. Click on the following link to complete the verification process:</span>
</p>
<p style="font-weight:normal;color:#333333;padding:0;">
<span>${process.env.FRONTEND_URL}/${
    isRegister
    ?
    "validate/registration"
    :
    "validate/email"
}/${link}</span>
</p>
<div style="clear: both">
</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
<table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
<tr>
<td cellpadding="0" cellspacing="0" style="vertical-align: top;">
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;overflow:hidden;">
<tr class="content-row">
<td class="content-cell" width="540" style="padding-left:30px;padding-right:30px;padding-top:10px;padding-bottom:30px;" >
<table cellpadding="0" border="0" cellspacing="0" align="left" class="sp-button flat auto-width" style="width:auto !important;border-radius:5px;box-shadow: none; background: #007e60">
<tbody>
<tr>
<td class="sp-button-text" style="align:left;border-radius:5px;width:auto;height:40px;vertical-align:middle;text-align:center;">
<table cellpadding="0" border="0" cellspacing="0" width="100%">
<tr>
<td align="center">
<a  style="padding:12px 18px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-family-short:arial;font-size:16px;font-weight:bold;color:#FFFFFF;display:block;" href="${process.env.FRONTEND_URL}/${
    isRegister
    ?
    "validate/registration"
    :
    "validate/email"
}/${link}">Click here to verify</a>
</td>
</tr>
</table>
</td>
</tr>
</tbody>
</table>
<div style="clear: both">
</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
</th>
</tr>
</table>
</td>
</tr>
</table>
<table  cellpadding="0" cellspacing="0" style="width:100%;" border="0">
<tr>
<td  style="padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;vertical-align:top;"  border="0" cellpadding="0" cellspacing="0">
<table cellpadding="0" cellspacing="0" style="width:100%;" border="0">
<tr>
<th width="600" style="vertical-align:top" cellpadding="0" cellspacing="0" class="tc responsive ">
<table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
<tr>
<td cellpadding="0" cellspacing="0" style="vertical-align: top;">
<table class="separator" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; background-color:#eeeeee;padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;height:35px;">
<tr>
<td height="35">
</td>
</tr>
</table>
</td>
</tr>
</table>
</th>
</tr>
</table>
</td>
</tr>
</table>
<table  cellpadding="0" cellspacing="0" style="width:100%;" border="0">
<tr>
<td  style="padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;vertical-align:top;"  border="0" cellpadding="0" cellspacing="0">
<table cellpadding="0" cellspacing="0" style="width:100%;" border="0">
<tr>
<th width="600" style="vertical-align:top" cellpadding="0" cellspacing="0" class="tc responsive ">
<table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
<tr>
<td cellpadding="0" cellspacing="0" style="vertical-align: top;">
<table width="100%" cellpadding="0" cellspacing="0" id="wout_block_out_block_8" style="text-color:black;background-color:#eeeeee;font-weight:normal;margin:0;border-collapse:separate;overflow:hidden;">
<tr class="content-row">
<td class="content-cell padding-top-0 padding-bottom-0" width="540" style="padding-left:30px;padding-right:30px;padding-top:0px;padding-bottom:0px;" >
<p style="text-align:center;font-weight:normal;padding:0;">
<span style="font-size: 13px; line-height: 19.5px;">© Copyright, 2024, ElasticDash, contact@elasticdash.com</span>
</p>
<div style="clear: both">
</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
<table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
<tr>
<td cellpadding="0" cellspacing="0" style="vertical-align: top;">
<table width="100%" cellpadding="0" cellspacing="0" id="wout_block_out_block_10" style="text-color:black;background-color:#eeeeee;font-weight:normal;margin:0;border-collapse:separate;overflow:hidden;">
<tr class="content-row">
<td class="content-cell padding-top-0" width="540" style="padding-left:30px;padding-right:30px;padding-top:0px;padding-bottom:30px;" >
<p style="text-align:center;font-weight:normal;padding:0;">
<span style="font-size: 13px;">This email has been sent to you, because you are a customer or subscriber of Oyabun. <a href="${unsubscribeUrl}">Unsubscribe</a>
</span>
</p>
<div style="clear: both">
</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
</th>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
<table width="600px">
</table>
</td>
</tr>
</table>
</div>
</body>
</html>
    `

    return html;
}

export const resetPassswordEmailContent = (link, unsubscribeUrl) => {
    console.log('resetPassswordEmailContent is triggered');
    console.log('link: ', link);
    console.log('unsubscribeUrl: ', unsubscribeUrl);

    const html = `
    <!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>
</title>
 <style type="text/css">
table,td{border-collapse:collapse}img{height:auto;line-height:100%;outline:0}a,img{text-decoration:none}h1,h2,h3,h4,h5,p{line-height:1.5;margin:0 0 10px}ul>li{mso-special-format:bullet}h1,h2,h3,h4,h5{line-height:1.2;font-weight:400}h1{font-size:36px}h2{font-size:30px}h3{font-size:24px}h4{font-size:20px}h5,p{font-size:14px}hr{margin:0}th.social_element,th.tc{font-weight:400;text-align:left}td,th,tr{border-color:transparent}.content-cell{vertical-align:top}.content-cell table.social,.content-cell table.social table,.content-cell table.social td,.content-cell table.social th,.content-cell table.sp-button,.content-cell table.sp-button table,.content-cell table.sp-button td,.content-cell table.sp-button th,img{border:0}.content-cell table.social td,.content-cell table.social th,.content-cell table.sp-button td,.content-cell table.sp-button th{padding:0}.content-cell .sp-button table td,.content-cell table.social{line-height:1}.content-cell>center>.sp-button{margin-left:auto;margin-right:auto}.content-cell .social,.content-cell .social_element,.content-cell .sp-button-side-padding,.content-cell .sp-button-text{border-color:transparent;border-width:0;border-style:none}.content-cell .sp-button-side-padding{width:21px}.content-cell .sp-button-text a{text-decoration:none;display:block}.content-cell .sp-button-text a img,.sp-video img{max-width:100%}.content-cell em,.content-cell span[style*=color]>a,.email-text .data_text em,.email-text em,.email-wrapper span[style*=color]>a{color:inherit}.content-cell>div>.sp-img,.content-cell>div>a>.sp-img{margin:0}.content-cell .link_img,.content-cell table.social .social_element img.social,.social_element img.social,.sp-video a{display:block}.content-cell .sp-button-img td{display:table-cell!important;width:initial!important}.content-cell>p,.email-text .data_text>p,.email-text>p{line-height:inherit;color:inherit;font-size:inherit}.content-cell>table,.content-cell>table>tbody>tr>td,.content-cell>table>tbody>tr>th,.content-cell>table>tr>td,.content-cell>table>tr>th,.email-text .data_text>table,.email-text .data_text>table>tbody>tr>td,.email-text .data_text>table>tbody>tr>th,.email-text .data_text>table>tr>td,.email-text .data_text>table>tr>th,.email-text>table,.email-text>table>tbody>tr>td,.email-text>table>tbody>tr>th,.email-text>table>tr>td,.email-text>table>tr>th{border-color:#ddd;border-width:1px;border-style:solid}.content-cell>table td,.content-cell>table th,.email-text .data_text>table td,.email-text .data_text>table th,.email-text>table td,.email-text>table th{padding:3px}.content-cell table.social .social_element,.social_element{padding:2px 5px;font-size:13px;font-family:Arial,sans-serif;line-height:32px}.content-cell table.social .social_element_t_3 img.social,.content-cell table.social .social_element_t_4 img.social,.content-cell table.social .social_element_t_5 img.social,.content-cell table.social .social_element_v_i_t img.social{display:inline}.email-text table th{text-align:center}.email-text pre{background-color:transparent;border:0;color:inherit;padding:0;margin:1em 0}.sp-video a{overflow:auto}@media only screen and (max-width:640px){.sp-hidden-mob{display:none!important}}
a{color:#0089bf;}
body,.content-row,p,h1,h2,h3,h4,h5,h6,li{color:#444444;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;}
body,table,div,p,li{font-size:14px;line-height:1.5;}
</style>
<style type="text/css">
table,td{border-collapse:collapse}img{height:auto;line-height:100%;outline:0;-ms-interpolation-mode:bicubic}a,img{text-decoration:none}h1,h2,h3,h4,h5,p{line-height:1.5;margin:0 0 10px}ul>li{mso-special-format:bullet}h1,h2,h3,h4,h5{line-height:1.2;font-weight:400}h1{font-size:36px}h2{font-size:30px}h3{font-size:24px}h4{font-size:20px}h5,p{font-size:14px}hr{margin:0}th.social_element,th.tc{font-weight:400;text-align:left}td,th,tr{border-color:transparent}.content-cell{vertical-align:top}.content-cell table.social,.content-cell table.social table,.content-cell table.social td,.content-cell table.social th,.content-cell table.sp-button,.content-cell table.sp-button table,.content-cell table.sp-button td,.content-cell table.sp-button th,img{border:0}#outlook a,.content-cell table.social td,.content-cell table.social th,.content-cell table.sp-button td,.content-cell table.sp-button th{padding:0}.content-cell .sp-button table td,.content-cell table.social{line-height:1}.content-cell>center>.sp-button{margin-left:auto;margin-right:auto}.content-cell .social,.content-cell .social_element,.content-cell .sp-button-side-padding,.content-cell .sp-button-text{border-color:transparent;border-width:0;border-style:none}.content-cell .sp-button-side-padding{width:21px}.content-cell .sp-button-text a{text-decoration:none;display:block}.content-cell .sp-button-text a img,.sp-video img{max-width:100%}.content-cell em,.content-cell span[style*=color]>a,.email-text .data_text em,.email-text em,.email-wrapper span[style*=color]>a{color:inherit}.content-cell>div>.sp-img,.content-cell>div>a>.sp-img,body{margin:0}.content-cell .link_img,.content-cell table.social .social_element img.social,.social_element img.social,.sp-video a{display:block}.content-cell .sp-button-img td{display:table-cell!important;width:initial!important}.content-cell>p,.email-text .data_text>p,.email-text>p{line-height:inherit;color:inherit;font-size:inherit}.content-cell>table,.content-cell>table>tbody>tr>td,.content-cell>table>tbody>tr>th,.content-cell>table>tr>td,.content-cell>table>tr>th,.email-text .data_text>table,.email-text .data_text>table>tbody>tr>td,.email-text .data_text>table>tbody>tr>th,.email-text .data_text>table>tr>td,.email-text .data_text>table>tr>th,.email-text>table,.email-text>table>tbody>tr>td,.email-text>table>tbody>tr>th,.email-text>table>tr>td,.email-text>table>tr>th{border-color:#ddd;border-width:1px;border-style:solid}.content-cell>table td,.content-cell>table th,.email-text .data_text>table td,.email-text .data_text>table th,.email-text>table td,.email-text>table th{padding:3px}.content-cell table.social .social_element,.social_element{padding:2px 5px;font-size:13px;font-family:Arial,sans-serif;line-height:32px}.content-cell table.social .social_element_t_3 img.social,.content-cell table.social .social_element_t_4 img.social,.content-cell table.social .social_element_t_5 img.social,.content-cell table.social .social_element_v_i_t img.social{display:inline}.email-text table th{text-align:center}.email-text pre{background-color:transparent;border:0;color:inherit;padding:0;margin:1em 0}.sp-video a{overflow:auto}@media only screen and (max-width:640px){.sp-hidden-mob{display:none!important} }body{padding:0}*{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0;mso-table-rspace:0}.ExternalClass,.ReadMsgBody{width:100%}.ExternalClass *{line-height:100%}table{margin-bottom:0!important;border-color:transparent}u~div .gmail-hide{display:none}u~div .gmail-show{display:block!important}@media yahoo {.yahoo-hide{display:none}.yahoo-show{display:block!important} }.im{color:inherit!important}td[class^=xfmc]{width:inherit!important}@media only screen and (max-width:640px){.wrapper-table{min-width:296px}.sp-demo-label-link{display:block}td,th{margin-bottom:0;height:inherit!important}td.content-cell,th.content-cell{padding:15px!important}table.email-checkout.email-checkout-yandex,td.content-cell .social,th.content-cell .social{width:auto!important}td.content-cell .share th,td.content-cell .social td .share td,td.content-cell .social th,th.content-cell .share th,th.content-cell .social td .share td,th.content-cell .social th{display:inline-block!important}td,td.content-cell .share th.social_element_t_3,td.content-cell .share th.social_element_t_4,td.content-cell .social td .share td.social_element_t_3,td.content-cell .social td .share td.social_element_t_4,td.content-cell .social th.social_element_t_3,td.content-cell .social th.social_element_t_4,th,th.content-cell .share th.social_element_t_3,th.content-cell .share th.social_element_t_4,th.content-cell .social td .share td.social_element_t_3,th.content-cell .social td .share td.social_element_t_4,th.content-cell .social th.social_element_t_3,th.content-cell .social th.social_element_t_4{display:block!important}td.content-cell .share th a>img,td.content-cell .social td .share td a>img,td.content-cell .social th a>img,th.content-cell .share th a>img,th.content-cell .social td .share td a>img,th.content-cell .social th a>img{width:32px!important;height:32px!important}td.content-cell>td,th.content-cell>td{width:100%}td.content-cell>p,th.content-cell>p{width:100%!important}td.content-cell.padding-lr-0,th.content-cell.padding-lr-0{padding-left:0!important;padding-right:0!important}td.content-cell.padding-top-0,th.content-cell.padding-top-0{padding-top:0!important}td.content-cell.padding-bottom-0,th.content-cell.padding-bottom-0{padding-bottom:0!important}.sp-video{padding-left:15px!important;padding-right:15px!important}.wrapper-table>tbody>tr>td{padding:0}.block-divider{padding:2px 15px!important}.social_share{width:16px!important;height:16px!important}.sp-button td{display:table-cell!important;width:initial!important}.sp-button td.sp-button-side-padding{width:21px!important}input{max-width:100%!important}table{border-width:1px}.tc{width:100%!important}.inline-item,table.smallImg td.smallImg{display:inline!important}table.origin-table{width:95%!important}table.origin-table td{display:table-cell!important;padding:0!important}.p100_img{width:100%!important;max-width:100%!important;height:auto!important}table.social{width:initial!important} }@media only screen and (max-width:640px) and screen and (-ms-high-contrast:active),only screen and (max-width:640px) and (-ms-high-contrast:none){td,th{float:left;width:100%;clear:both}.content-cell img,img:not(.p100_img){width:auto;height:auto;max-width:269px!important;margin-right:auto;display:block!important;margin-left:auto} }.content-cell{word-break:break-word}.content-cell *{-webkit-box-sizing:border-box;box-sizing:border-box}.rollover{font-size:0}@media only screen and (max-width:640px){.rollover img.sp-img.desktop,.rollover img.sp-img.desktop.rollover-first,.rollover img.sp-img.desktop.rollover-second,img.sp-img.desktop{display:none!important}img.sp-img.mobile{display:block!important} }@media only screen and (min-width:641px){.rollover img.sp-img.mobile,.rollover img.sp-img.mobile.rollover-first,.rollover img.sp-img.mobile.rollover-second{display:none!important} }
.rollover:hover .desktop.rollover-first,
.rollover:hover .mobile.rollover-first{
    max-height: 0 !important;
    display: none !important;
}
.rollover .desktop.rollover-second,
.rollover .mobile.rollover-second {
    max-height: 0 !important;
    display: none !important;
}
.rollover:hover .desktop.rollover-second,
.rollover:hover .mobile.rollover-second {
    max-height: none !important;
    display: block !important;
    object-fit: cover;
}
td.content-cell .social th{
  display: inline-block !important;
}
@media only screen and (max-width:640px){
    table {
        width: 100% !important;
    }
    table,hr {
        width: 100%;
        max-width: 100% !important;
    }
    td,div {
        width: 100% !important;
        height: auto !important;
        box-sizing: border-box;
    }
    td,th {
        display: block !important;
        margin-bottom: 0;
        height: inherit !important;
    }
}
</style>
</head>
<body style="margin:0">
<div style="background-color: #eeeeee;">
<table class="wrapper-table" cellpadding="5" cellspacing="0" width="100%" border="0" style="background-repeat:no-repeat;background-position:left top;" background="https://s8053915.sendpul.se/image" >
<!--[if gte mso 9]>
<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
<v:fill type="frame" color="#eeeeee"/>
        </v:background>
        <![endif]-->
        <tr>
        <td align="center">
        <table cellpadding="0" cellspacing="0" width="600px" id="bodyTable" border="0" bgcolor="#ffffff">
        <tr>
        <td border="0" cellpadding="0" cellspacing="0">
        <table  cellpadding="0" cellspacing="0" style="width:100%;" border="0">
        <tr>
        <td  style="padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;vertical-align:top;"  border="0" cellpadding="0" cellspacing="0">
        <table cellpadding="0" cellspacing="0" style="width:100%;" border="0">
        <tr>
        <th width="600" style="vertical-align:top" cellpadding="0" cellspacing="0" class="tc responsive ">
        <table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
        <tr>
        <td cellpadding="0" cellspacing="0" style="vertical-align: top;">
        <table width="100%" cellpadding="0" cellspacing="0" id="wout_block_2_element_0" style="background-color:#eeeeee;border-collapse:separate;overflow:hidden;">
        <tr class="content-row">
        <td class="content-cell padding-lr-0 padding-top-0 padding-bottom-0" width="600" style="padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;" >
        <div id="wout_block_2_element_0" style="width:100%;height:57;display:block;">
        <img border="0" width="300" height="57" class="desktop  sp-img small_img " align="left" alt="Oyabun_Logo" src="https://s8053915.sendpul.se/files/emailservice/userfiles/708c67d0048fb91029d1237653e73fd78053915/Untitled_design.png"iout_block_2_element_0 style="display:block;-ms-interpolation-mode:bicubic;"/>
        <!--[if !mso]>
        <!-->
        <div style="mso-hide:all;">
        <img border="0" width="300" height="57" class="mobile  sp-img small_img " align="left" alt="Oyabun_Logo" src="https://s8053915.sendpul.se/files/emailservice/userfiles/708c67d0048fb91029d1237653e73fd78053915/Untitled_design.png"iout_block_2_element_0 style="display:block;-ms-interpolation-mode:bicubic;display:none;width:100%; max-width:100% !important;"/>
        </div>
        <!--<![endif]-->
        </div>
        <div style="clear: both">
        </div>
        </td>
        </tr>
        </table>
        </td>
        </tr>
        </table>
        <table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
        <tr>
        <td cellpadding="0" cellspacing="0" style="vertical-align: top;">
        <table class="separator" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; background-color:#eeeeee;padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;height:20px;">
        <tr>
        <td height="20">
        </td>
        </tr>
        </table>
        </td>
        </tr>
        </table>
        </th>
        </tr>
        </table>
        </td>
        </tr>
        </table>
        <table  cellpadding="0" cellspacing="0" style="width:100%;" border="0">
        <tr>
        <td  style="padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;vertical-align:top;"  border="0" cellpadding="0" cellspacing="0">
        <table cellpadding="0" cellspacing="0" style="width:100%;" border="0">
        <tr>
        <th width="600" style="vertical-align:top" cellpadding="0" cellspacing="0" class="tc responsive ">
        <table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
        <tr>
        <td cellpadding="0" cellspacing="0" style="vertical-align: top;">
        <table width="100%" cellpadding="0" cellspacing="0" id="wout_block_out_block_5" style="text-color:black;background-color:transparent;font-weight:normal;color:#333333;margin:0;border-collapse:separate;overflow:hidden;">
        <tr class="content-row">
        <td class="content-cell padding-bottom-0" width="540" style="padding-left:30px;padding-right:30px;padding-top:20px;padding-bottom:0px;" >
        <h4 style="font-weight:normal;color:#333333;">
        <span>Trouble signing in? </span>
        </h4>
<p style="font-weight:normal;color:#333333;padding:0;">
<span>Just press the button below and follow the instructions. We'll have you up and running in no time. Click on the following link to complete the verification process:</span>
</p>
<p style="font-weight:normal;color:#333333;padding:0;">
<span>${process.env.FRONTEND_URL}/resetpassword/${link}</span>
</p>
<div style="clear: both">
</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
<table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
<tr>
<td cellpadding="0" cellspacing="0" style="vertical-align: top;">
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;overflow:hidden;">
<tr class="content-row">
<td class="content-cell" width="540" style="padding-left:30px;padding-right:30px;padding-top:10px;padding-bottom:30px;" >
<table cellpadding="0" border="0" cellspacing="0" align="left" class="sp-button flat auto-width" style="width:auto !important;border-radius:5px;box-shadow: none; background: #007e60">
<tbody>
<tr>
<td class="sp-button-text" style="align:left;border-radius:5px;width:auto;height:40px;vertical-align:middle;text-align:center;">
<table cellpadding="0" border="0" cellspacing="0" width="100%">
<tr>
<td align="center">
<a  style="padding:12px 18px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-family-short:arial;font-size:16px;font-weight:bold;color:#FFFFFF;display:block;" href="${
    process.env.FRONTEND_URL
}/resetpassword/${
    link
}">Click here to reset your password</a>
</td>
</tr>
</table>
</td>
</tr>
</tbody>
</table>
<div style="clear: both">
</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
</th>
</tr>
</table>
</td>
</tr>
</table>
<table  cellpadding="0" cellspacing="0" style="width:100%;" border="0">
<tr>
<td  style="padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;vertical-align:top;"  border="0" cellpadding="0" cellspacing="0">
<table cellpadding="0" cellspacing="0" style="width:100%;" border="0">
<tr>
<th width="600" style="vertical-align:top" cellpadding="0" cellspacing="0" class="tc responsive ">
<table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
<tr>
<td cellpadding="0" cellspacing="0" style="vertical-align: top;">
<table class="separator" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; background-color:#eeeeee;padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;height:35px;">
<tr>
<td height="35">
</td>
</tr>
</table>
</td>
</tr>
</table>
</th>
</tr>
</table>
</td>
</tr>
</table>
<table  cellpadding="0" cellspacing="0" style="width:100%;" border="0">
<tr>
<td  style="padding-left:0px;padding-right:0px;padding-top:0px;padding-bottom:0px;vertical-align:top;"  border="0" cellpadding="0" cellspacing="0">
<table cellpadding="0" cellspacing="0" style="width:100%;" border="0">
<tr>
<th width="600" style="vertical-align:top" cellpadding="0" cellspacing="0" class="tc responsive ">
<table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
<tr>
<td cellpadding="0" cellspacing="0" style="vertical-align: top;">
<table width="100%" cellpadding="0" cellspacing="0" id="wout_block_out_block_8" style="text-color:black;background-color:#eeeeee;font-weight:normal;margin:0;border-collapse:separate;overflow:hidden;">
<tr class="content-row">
<td class="content-cell padding-top-0 padding-bottom-0" width="540" style="padding-left:30px;padding-right:30px;padding-top:0px;padding-bottom:0px;" >
<p style="text-align:center;font-weight:normal;padding:0;">
<span style="font-size: 13px; line-height: 19.5px;">© Copyright, 2024, ElasticDash, contact@elasticdash.com</span>
</p>
<div style="clear: both">
</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
<table border="0" width="100%" cellpadding="0" cellspacing="0"  style="border-top-right-radius:0px;border-top-left-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;">
<tr>
<td cellpadding="0" cellspacing="0" style="vertical-align: top;">
<table width="100%" cellpadding="0" cellspacing="0" id="wout_block_out_block_10" style="text-color:black;background-color:#eeeeee;font-weight:normal;margin:0;border-collapse:separate;overflow:hidden;">
<tr class="content-row">
<td class="content-cell padding-top-0" width="540" style="padding-left:30px;padding-right:30px;padding-top:0px;padding-bottom:30px;" >
<p style="text-align:center;font-weight:normal;padding:0;">
<span style="font-size: 13px;">This email has been sent to you, because you are a customer or subscriber of Oyabun. <a href="${unsubscribeUrl}">Unsubscribe</a>
</span>
</p>
<div style="clear: both">
</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
</th>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
<table width="600px">
</table>
</td>
</tr>
</table>
</div>
</body>
</html>
    `

    return html;
}
