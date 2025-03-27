
    var table = $("#data_table").DataTable({
    "searching": true,
    "ordering": false,
    "aLengthMenu": [
        [10, 15, 25, 50, 100, -1],
        [10, 15, 25, 50, 100, "All"]
    ],
    "language": {
        "lengthMenu": "Show _MENU_",
    },
    "dom": "<'row mb-2'" +
        "<'col-sm-6 d-flex align-items-center justify-conten-start dt-toolbar'lB>" +
        "<'col-sm-6 d-flex align-items-center justify-content-end dt-toolbar'f>" +
        ">" +
        "<'table-responsive'tr>" +
        "<'row'" +
        "<'col-sm-12 col-md-5 d-flex align-items-center justify-content-center justify-content-md-start'i>" +
        "<'col-sm-12 col-md-7 d-flex align-items-center justify-content-center justify-content-md-end'p>" +
        ">",
    "buttons": [
        {
            extend: 'excel',
            text: '<i class="fa-solid fa-download logo_color"></i>&nbsp;Export to Excel',
            className: 'ms-2 btn-sm',
            action: function (e, dt, node, config) {
                dt.button(node).processing(true);
                let searchText = dt.search();
                let filterData = $("#filterForm").serializeArray();
                filterData.push({ name: "search", value: searchText });

                $.ajax({
                    url: baseUrl + "/api/exportPaymentHistory",
                    type: "POST",
                    data: filterData,

                    success: function (response) {
                        if (response.success) {

                            let link = document.createElement("a");
                            link.href = baseUrl + "/" + response.filePath; // Append base URL if needed
                            link.download = ""; // Let browser use the original filename
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        } else {
                            alert("Error generating file.");
                        }
                    },
                    error: function (xhr, status, error) {
                        alert("Error exporting data: " + error);
                    },
                    complete: function () {
                        // Hide the loader after request completion
                        dt.button(node).processing(false);
                    }
                });
            }
        },
    ],
    "processing": true,
    "serverSide": true,
    "serverMethod": "post",
    "ajax": {
        "url":baseUrl +"/api/paymentHistory",
        "accept": "application/json",
        "type":"POST",
        "data": function (d) {
            let formData = $("#filterForm").serializeArray().reduce((obj, item) => {
                obj[item.name] = item.value;
                return obj;
            }, {});

            return Object.assign(d, formData); // Merge filter values into DataTables request
        },
        "beforeSend": function (xhr) {

        },
    },

    "columns": [
    {
        data: "cust_name",
        className:"text-center"
    },
    // {
    //     data: "email",
    //     className:"text-center"
    // },
    {
        data: "phone_no",
        className:"text-center"
    },

    {
        data: "status",
        visible:isActionVisible,
        className:"text-center"
    },
    {
        data: "billing_amount",
        className:"text-center"
    },
    {
        data: "product",
        className:"text-center"
    },
    {
        data: "subscription_start_date",
        className:"text-center"
    },
    {
        data: "subscription_end_date",
        className:"text-center"
    },
    {
        data: "created_date",
        className:"text-center"
    },

    {
        data: "action",
        searchable: false,
        orderable: false,
        className: "w-170px",
        visible:isActionVisible
    }
    ]
});

  function view_data(id) {
    var actionUrl = baseUrl + "/api/getPaymentDetails";
    //var method = "GET";
    $.ajax({
      url: actionUrl,
      data:{id:id},
      method: "POST",
      dataType: "json",
      beforeSend: function () {},
      success: function (response) {
        toastr.remove();
        if (response.status) {
            subscription_html(response.data)

        } else {
          //toastr.error(response.message);
          fail_message(response.message);
        }
      },
      error: function (response) {
        toastr.remove();
        //toastr.error(response.message);
        fail_message(response.message);
      },
    });
  }


  function subscription_html(data)
  {
    console.log(data)
    var html=`
    <div class="row">
            <div class="col-6">
              <h4 class="fw-bold">Bill To:</h4>
              <p class="fs-6 text-muted m-0"></p>
              <a href="admin/view-customer/${data.customer_id}" target="_blank" class="fw-bold text-gray-800 text-hover-primary me-2">
                          ${data.customer_name} </a>
                        <span class="badge badge-light-success">Active</span>
              <p class="fs-6 text-muted m-0">${data.customer_country}</p>
              <p class="fs-6 text-muted m-0"><a href="#" class="text-primary">${data.customer_email}</a></p>
              <p class="fs-6 text-muted m-0">Phone: ${data.customer_phone_number}</p>
            </div>
            <div class="col-6 text-end">
              <h4 class="fw-bold">Invoice #${data.id}</h4>
              <p class="fs-6 text-muted mb-0">Issued: ${data.created_at}</p>
              <p class="fs-6 text-muted">Due: ${data.subscription_end_date}</p>

            </div>
          </div>


          <div class="row">

            <div class="col-7">

              <div class="table-responsive mt-2">
                <table class="table table-borderless align-middle">
                  <thead>
                    <tr class="border-bottom border-gray-300">
                      <th class="text-start text-muted fw-bold">Item</th>
                      <th class="text-center text-muted fw-bold">Billing Method</th>
                      <th class="text-end text-muted fw-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="border-bottom">`;
                    if(data.subscription_for=='plan')
                    {
                    html+=`<td class="fw-bold text-gray-800">${data.plan_name}</td>
                    <td class="text-center text-gray-600">${data.plan_type}</td>`;
                    }
                    if(data.subscription_for=='course')
                    {
                    html+=`<td class="fw-bold text-gray-800">${data.course_names}</td>
                    <td class="text-center text-gray-600">-</td>`;
                    }
                      html+=`<td class="text-end fw-bold">₹${data.total}</td>
                    </tr>

                  </tbody>
                </table>
              </div>


              <div class="d-flex justify-content-end">
                <div class="w-50">
                  <div class="d-flex justify-content-between py-2">
                    <span class="text-muted">Subtotal:</span>
                    <span class="fw-bold">₹${data.subtotal}</span>
                  </div>
                  <div class="d-flex justify-content-between py-2">
                    <span class="text-muted">Tax (${data.service_tax_percentage}%):</span>
                    <span class="fw-bold">₹${data.service_tax_amount}</span>
                  </div>
                  <div class="d-flex justify-content-between py-2">
                    <span class="text-muted">GST (${data.gst_percentage}%):</span>
                    <span class="fw-bold">₹${data.gst_amount}</span>
                  </div>
                  <div class="d-flex justify-content-between py-2 border-top pt-2">
                    <span class="fs-5 fw-bold">Total:</span>
                    <span class="fs-5 fw-bold text-primary">₹${data.total}</span>
                  </div>
                </div>
              </div>

            </div>`;


            html+=`
            <div class="col-5">
              <div class="flex-column flex-lg-row-auto order-1 order-lg-2">
                <div class="card card-flush mb-0" data-kt-sticky="true" data-kt-sticky-name="subscription-summary" data-kt-sticky-offset="{default: false, lg: '200px'}" data-kt-sticky-width="{lg: '250px', xl: '300px'}" data-kt-sticky-left="auto" data-kt-sticky-top="150px" data-kt-sticky-animation="false" data-kt-sticky-zindex="95" style="" data-kt-sticky-enabled="true">
                  <div class="card-header">
                    <div class="card-title">
                      <h2>Summary</h2>
                    </div>
                  </div>

                  <div class="card-body pt-0 fs-6">
                    <div class="">

                      <div class="d-flex align-items-center mb-2">
                        <div class="fw-semibold text-gray-600">
                        Transaction Id
                        <span class="badge badge-light-info">${data.transaction_id}</span>
                        </div>

                      </div>

                      `;

                    if(data.subscription_for=='plan')
                    {

                      html+=`
                      <h5 class="mb-3">Plan Features</h5>
                      <div class="fs-6 fw-semibold">
                        <p class="mb-2"><span class="text-gray-500 ">Simultaneous Devices:</span> <span class="text-gray-800 fw-bold">${data.simaltaneous_devices_accessible}</span></p>
                        <p class="mb-2"><span class="text-gray-500 ">Download:</span> <span class="text-gray-800 fw-bold">${data.download_devices}</span></p>
                        <p class="mb-2"><span class="text-gray-500 ">Course:</span> <span class="text-gray-800 fw-bold">${(data.courses != 'All' ? data.course_names : "All")}</span></p>
                        <p class="mb-2"><span class="text-gray-500 ">Craftschool Sessions:</span> <span class="text-gray-800 fw-bold">${data.craftschool_sessions_access}</span></p>
                        <p class="mb-2"><span class="text-gray-500 ">Supported Devices:</span> <span class="text-gray-800 fw-bold">${data.supported_devices}</span></p>
                        <p class="mb-2"><span class="text-gray-500 ">Community Access:</span> <span class="text-gray-800 fw-bold">${data.community_access}</span></p>
                    </div>

                      `;
                    }

                    if(data.subscription_for=='course')
                    {

                        html+=`
                        <h5 class="mb-3">Course Details</h5>
                        <div class="fs-6 fw-semibold">

                        <p class="mb-2"><span class="text-gray-500 d-block">Course:</span> <span class="text-gray-800 fw-bold">${(data.course_names)}</span></p>

                    </div>

                        `;
                    }

                    html+=`</div>



                  </div>
                </div>
              </div>`;


            html+`</div>
          </div>

          `;

    $("#subscription_div").html(html)
    $("#subscription_modal").modal("show");
  }

  $("#filter").click(function(){
    $("#data_table").DataTable().ajax.reload();
  });

  $("#filter_collapse").click(function(){
    $(".filter_card").toggleClass("hidden");
  });
$("#clear").click(function(){

    $("#filterForm")[0].reset()
    $("#data_table").DataTable().ajax.reload();
})
