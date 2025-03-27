$("#services_action").change(function(){
    var serviceaction=$("#services_action").val();
    var service_id=$(this).attr(data_attr);
    if(serviceaction=='Edit')
    {
        _status(1,service_id);
    }


});

function edit_services(service_id)
{
    $("#service_id").val(service_id)



    var actionUrl = baseUrl + '/api/get_particular_service_details';

    $.ajax({
        url: actionUrl,
        method: "POST",
        data: {service_id:service_id},
        dataType: "json",
        beforeSend: function () { },
        success: function (response) {

            if (response.status) {

                $("#title").val(response.data.title);
                $("#description").val(response.data.description);
                $("#edit_services").modal("show");

            } else {
                fail_message(response.message);
            }
        },
        error: function (response) {

            fail_message(response.message);
        }
    });
}

$("#save_service").click(function(){
        var formData = new FormData($("#service_data_form")[0]);


        url=baseUrl + "/api/update_craftschool_service";
        $.ajax({
            url: url,
            method: "POST",
            data: formData,
            processData: false,
            contentType: false,
            beforeSend: function (xhr) {
                $(".indicator-progress").show()
                $("#save_service").attr('disabled', true);
            },
            success: function (response) {
                $(".indicator-progress").hide()
                $(".error-message").remove();
                if (response.status) {
                    $("#edit_services").modal("hide");
                    success_message(response.message);

                    setTimeout(function () {
                        window.location = "/admin/craftschool-services";
                    }, 2000);

                } else {
                    fail_message(response.message);
                }
                $("#save_service").attr('disabled', false);
            },
            error: function (response) {
                $(".indicator-progress").hide()
                $("#save_service").attr('disabled', false);

                $(".error-message").remove();

                if (response.responseJSON && response.responseJSON.errors && response.responseJSON.errors.errors) {
                    response.responseJSON.errors.errors.forEach(function (error) {
                    // Select the input field based on the `path` in the error
                    const field = $(`[name="${error.path}"]`);
                    if (field.length) {
                        // Append error message next to the field
                        field.after(`<div class="error-message text-danger">${error.msg}</div>`);
                    }
                    });
                }
            }
        });


});
