// ==UserScript==
// @name         Twitch clip fixer
// @namespace    
// @version      0.1
// @description  Toggle to hide clips with the same names as the vods they were for. Doesnt work for older clips.
// @author       ScriptDaddy
// @match        https://dashboard.twitch.tv/u/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=twitch.tv
// @grant        none
// @run-at       document-end
// @require     https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.js
// @require 		https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.js
// @require   https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.js
// ==/UserScript==

(function($) {


    function whenReady(predicate, response, retryDelay, retryAttempts) {
        if (predicate()) {
            response();
        } else if (retryAttempts > 0) {
            setTimeout(whenReady.bind(this, predicate, response, retryDelay, retryAttempts - 1), retryDelay || 1000);
        } else {
            console.log("whenReady failed. max retries.")
        }
    }




    var getVideoManagerQueryChannelVideos = (function () {
        var oauth;
        var userId;
        if (localStorage.getItem('scriptDaddyClipFixOAuthModule') == null || localStorage.getItem('scriptDaddyClipFixOAuthModule') == "true") {
            (async function () {
                var authToken = await cookieStore.get('auth-token');
                var u = await cookieStore.get('twilight-user');
                if (u) {
                    userId = JSON.parse(decodeURIComponent(u.value)).id;
                }
                if (authToken) {
                    oauth = "OAuth " + authToken.value;
                }
            })();
        }else{
            console.log("oauth module disabled. will rely on localStorage as fallback. Please visit your video-producer page to keep localStorage up to date.");
        }

        var url = "https://gql.twitch.tv/gql";

        return async function () {
            var data={};
            if (oauth && userId) {
                try {
                    var t = [{
                        "operationName": "VideoManagerQuery_ChannelVideos",
                        "variables": {
                            "id": userId,
                            "first": 50,
                            "after": null
                        },
                        "extensions": {
                            "persistedQuery": {
                                "version": 1,
                                "sha256Hash": "84d4173c52bb87af461c5435c535b93354cf51fd5aeef5c67e7574bd2df20c8d"
                            }
                        }
                    }
                            ];

                    var channelVideosResponse = await fetch(url, {
                        method: "POST",
                        credentials: "same-origin",
                        headers: {
                            "authorization": oauth,
                            "Content-type": "application/json",
                            "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
                        },
                        body: JSON.stringify(t),
                    });

                    var channelVideos = await channelVideosResponse.json();

                    channelVideos[0].data.user.channel.managedVideos.edges.forEach(v => {


                        if (v.node.broadcastType == "ARCHIVE") {
                            data[v.node.id] = {
                                name: v.node.title,
                                broadcastType: "Past Broadcast"
                            };
                        }

                    });

                } catch (err) {
                    console.error(err);
                    var errCount = (localStorage.getItem("scriptDaddyClipFixOAuthErrorCount") || 0);
                    errCount++;
                    localStorage.setItem("scriptDaddyClipFixOAuthErrorCount", errCount);
                    console.error("gql requests failed. falling back to localstorage");
                    if (errCount > 20) {
                        console.log("excessive request errors. disabling gql module");
                        localStorage.setItem('scriptDaddyClipFixOAuthModule', 'false');
                        oauth = null;

                    }
                }
            }

            data = _.assign(JSON.parse(localStorage.getItem("scriptDaddyTwitchVideoArchive")), data);
            localStorage.setItem("scriptDaddyTwitchVideoArchive",JSON.stringify(data));
            return data;

        }
    })();


    var videoList;

    function saveKnownVideos(data){
        localStorage.setItem("TwitchVideoArchive",JSON.stringify(data));
    }

    async function videoProducerPage(){
        console.log('video producer page identified');
        whenReady(
            ()=> $('[data-target="video-card"]').length > 0,
            ()=>{
                $('[data-target="video-card"]').each(function(i, el){
                    var vidId = $(el).find('.tw-card').data('video-id');
                    var type = $(el).find('[data-test-selector="video-card-broadcast-type-stat-selector"]').text().trim();
                    var name = $(el).find('[data-a-target="video-card-container"] h5').text().trim();
                    if(!videoList[vidId] && type == "Past Broadcast" ){
                        console.log(vidId);
                        console.log(type);
                        videoList[vidId]={name:name,type:type};

                    }
                });
                console.log(videoList);
                saveKnownVideos(videoList);             
            },
            500,20);
    }

    var clipListObserver = new MutationObserver((mutationsList, observer) => {
        mutationsList.forEach(mu=>{
            mu.addedNodes.forEach(ad=>{
                filterElement(ad);
            });

        })

    });


    function runFilter(){

        $('[data-a-target="clips-manager-table-row-container"]').each(function(i,el){
            filterElement(el);

        });
    }

    function filterElement(el){
        if( $('#tw-script-daddys-clip-fix').is(':checked')){

            var clipName = $(el).find('h5').text().trim();
            _.forIn(videoList, (v,k)=>{
                if(clipName == v.name && $(el).find('img.clmgr-thumb')[0].src.indexOf('vod-'+k) != -1){
                    console.log('clip with default name found: %s', clipName);
                    $(el).attr('style', 'display: none !important');
                }
            });
        }else{
            $(el).show();
        }

    }
    function clipsPage(){
        console.log('clips page identified');



        whenReady(
            ()=>$('[data-simplebar="init"] .scrollable-trigger__wrapper').length>0,
            ()=>{

                $(`
<div class="Layout-sc-nxg1ff-0 ihmJEc" style="margin-left: 2rem;">
  <div class="Layout-sc-nxg1ff-0 dSOvTr tw-checkbox">
  <input name="filter-default-named-clips-type" type="checkbox" class="ScCheckBoxInputBase-sc-1wz0osy-1 eClELb tw-checkbox__input" data-a-target="tw-checkbox" id="tw-script-daddys-clip-fix" >
  <label class="ScCheckBoxLabelBase-sc-1wz0osy-2 ScCheckBoxLabel-sc-pdmsc3-0 iXepmq hbiDLS tw-checkbox__label" for="tw-script-daddys-clip-fix">
      <div class="Layout-sc-nxg1ff-0 ftpuvo">Hide Default Named</div>
    </label></div>
</div>
                 `).insertAfter($('.clips-manager-header-created-clips-search__search-field, .clips-manager-header-channel-clips-search__category-search')).find('#tw-script-daddys-clip-fix').change(function(){
                    console.log('running filter');
                    runFilter();

                })

                clipListObserver.observe($('[data-a-target="clips-manager-table-row-container"]').parent()[0], {
                    attributes: false,
                    childList: true,
                    subtree: false
                });


                runFilter();
            },
            500,20);

    }

    async function pageChanged(){
        clipListObserver.disconnect();
        videoList = await getVideoManagerQueryChannelVideos();
        var urlArr = window.location.pathname.split('/');
        if(urlArr[4] == 'video-producer'){
            videoProducerPage(videoList);
        }else if(urlArr[4] == 'clips'){
            clipsPage(videoList);
        }


    }
    var throttledPageChanged = _.throttle(pageChanged,250, {'leading': false});
    throttledPageChanged();

    var pageChangeObserver = new MutationObserver((mutationsList, observer) => {
        if (mutationsList[0].removedNodes[0].textContent != mutationsList[0].addedNodes[0].textContent) {
            console.log("%s   =>  %s", mutationsList[0].removedNodes[0].textContent, mutationsList[0].addedNodes[0].textContent);
            throttledPageChanged();
        }
    });

    setTimeout(() => {
        pageChangeObserver.observe($('title')[0], {
            attributes: false,
            childList: true,
            subtree: false
        });
    }, 2000);


})(jQuery);







