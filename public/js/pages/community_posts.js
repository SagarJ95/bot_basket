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
        "<'col-sm-6 d-flex align-items-center justify-conten-start dt-toolbar'l>" +
        "<'col-sm-6 d-flex align-items-center justify-content-end dt-toolbar'f>" +
        ">" +
        "<'table-responsive'tr>" +
        "<'row'" +
        "<'col-sm-12 col-md-5 d-flex align-items-center justify-content-center justify-content-md-start'i>" +
        "<'col-sm-12 col-md-7 d-flex align-items-center justify-content-center justify-content-md-end'p>" +
        ">",
    "processing": true,
    "serverSide": true,
    "serverMethod": "post",
    "ajax": {
        "url": baseUrl + "/api/getCommunityPosts",
        "accept": "application/json",
        "beforeSend": function (xhr) {

        },
    },
    //
    // sample_video,trailor_video
    // course_name,master_name,instructer,short_description,
    // course_cost,duration,type,no_of_modules,category,subcategory,

    "columns": [{
        data: "post",
        className:"text-center"
    },
    {
        data: "customer_name",
        className:"text-center"
    },
    {
        data: "likes",
        className:"text-center"
    },
    {
        data: "comments",
        className:"text-center"
    },
    {
        data: "reports",
        className:"text-center"
    },

    {
        data: "action",
        searchable: false,
        orderable: false,
        className: "text-center"
    }
    ]
});

table.on('draw', function () {
    if ($('[data-bs-toggle="tooltip"]') !== undefined) {
        $('[data-bs-toggle="tooltip"]').tooltip();
    }
});

function delete_data(id) {
    Swal.fire({
        // text: "Are you sure you want to delete ?",
        // icon: "warning",
        // showCancelButton: true,
        // buttonsStyling: false,
        // confirmButtonText: "Yes, delete!",
        // cancelButtonText: "No, cancel",
        // customClass: {
        //     confirmButton: "btn fw-bold btn-danger",
        //     cancelButton: "btn fw-bold btn-active-light-primary"
        // }

        icon: "warning",
        text: "Are you sure you want to delete ?",
        imageWidth: 48,
        imageHeight: 48,
        showCloseButton: true,
        showCancelButton: true,
        cancelButtonText: "Cancel",
        confirmButtonText: "Yes, Delete it!",
        cancelButtonColor: "#d33",
        confirmButtonColor: "#3085d6",
        width: 320,
        allowOutsideClick: false,
    }).then(function (result) {
        if (result.value) {

            $.ajax({
                url: '/api/community/' + id,
                method: "DELETE",
                DataTypes: "JSON",
                beforeSend: function (xhr) {

                },
                success: function (response) {
                    $(".indicator-progress").hide()
                    if (response.status) {

                        success_message(response.message);
                        $('#data_table').DataTable().ajax.reload();
                    } else {
                        fail_message(response.message);
                    }

                },
                error: function (response) {
                    fail_message(response.message);

                }
            });
        }
    });
}

function view_data(id) {
    $.ajax({
        url: '/api/community/' + id,
        method: "GET",
        DataTypes: "JSON",
        beforeSend: function (xhr) {
            toastr.remove();
            toastr.info("Please wait while we are processing your request.");
        },
        success: function (response) {
            toastr.remove();
            if (response.status) {
                $('#customerName').html(response.data.customer_name);
                $('#createdAt').html(response.data.created_at);
                $('#postContent').html(response.data.post);
                //console.log(response.data.medias);
                if (response.data.medias != []) {
                    //console.log(response.data.medias);
                    /*
                    var img = '';
                    response.data.medias.forEach(element => {
                        img += '<img src="' + element.media_path + '" class="img-fluid" alt="image" style="width: 100%; height: 100%;">';
                    });
                    $('#postImages').html(img);
                    */

                    var images = [];

                    response.data.medias.forEach(element => {
                        images.push({
                            src: element,
                            thumbnail: element
                        });
                    });

                    //console.log(images);
                    setTimeout(
                        ()=>{
                        $('#postImages').imagesGrid({
                            images: images,
                            align: true
                        });


                    },1000);


                }
                $('#viewModal').modal('show');
            } else {
                toastr.error(response.message);
            }

        },
        error: function (response) {
            toastr.remove();
            toastr.error(response.responseJson.message);
        }
    });
}

$(document).on('click', '#postImages .img, #postImages img,.view-all-text,.view-all-cover,.view-all,.imgs-grid-image', function () {
    console.log("Image clicked!"); // Debugging step
    $('#viewModal').modal('hide');
});
