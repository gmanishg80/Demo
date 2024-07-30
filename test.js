exports.newsfeedListing = [
    query('pageNumber').trim().exists().notEmpty().withMessage(validationMessage.PAGE_NUMBER_VALIDATION),
    query('limit').trim().exists().notEmpty().withMessage(validationMessage.LIMIT_VALIDATION),
    query('skipCategoryPost').trim().exists().notEmpty().withMessage(validationMessage.SKIP_CATEGORY_POST_VALIDATION),
    commonFunction.validateRequest,    //middleware to validate input request

    async (req, res) => {
        try {
            const pageNumber = Math.abs(parseInt(req.query?.pageNumber)) ?? 1;
            const limit = Math.abs(parseInt(req.query?.limit)) ?? 10;
            const skip = Math.abs((pageNumber - 1) * limit);
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

            // find the connections
            const findConnection = await CONNECTION.find({
                $or: [
                    { $and: [{ from_user_id: req.currentUser._id }, { $or: [{ from_connection_status: 'connected' }, { from_follow_status: true }] }] },
                    { $and: [{ to_user_id: req.currentUser._id }, { $or: [{ to_connection_status: 'connected' }, { to_follow_status: true }] }] }
                ]
            });

            let arr = [];
            for (let val of findConnection) {
                arr.push(val.from_user_id);
                arr.push(val.to_user_id);
            }

            // remove the duplicate ids from array
            const finalArr = [...new Set(arr)];
            console.log(finalArr)
            // single aggregation pipeline
            const posts = await POST.aggregate([
                {
                    $facet: {
                        connectionPosts: [
                            {
                                $match: {
                                    user_id: { $in: finalArr },
                                    createdAt: { $gte: threeDaysAgo }
                                }
                            },
                            {
                                $sort: { createdAt: -1 }
                            },
                            { $addFields: { order: 1 } },
                            // {
                            //     $lookup: {
                            //         from: 'users',
                            //         localField: 'user_id',
                            //         foreignField: '_id',
                            //         as: 'postUserData'
                            //     }
                            // }
                        ],
                        industryPosts: [
                            {
                                $lookup: {
                                    from: 'users',
                                    localField: 'user_id',
                                    foreignField: '_id',
                                    as: 'postUserData',
                                    pipeline: [
                                        {
                                            $match: {
                                                sub_category: { $elemMatch: { $in: req.currentUser.sub_category } }
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                $match: {
                                    'postUserData.0': { $exists: true },
                                    createdAt: { $gte: threeDaysAgo },
                                    user_id: { $nin: finalArr },

                                }
                            },
                            {
                                $sort: { createdAt: -1 }
                            },
                            { $addFields: { order: 2 } },
                        ],
                        appPosts: [
                            {
                                $match: {
                                    createdAt: { $gte: threeDaysAgo },
                                    user_id: { $nin: finalArr }
                                }
                            },
                            {
                                $sort: { createdAt: -1 }
                            },
                            { $addFields: { order: 3 } },
                            // {
                            //     $lookup: {
                            //         from: 'users',
                            //         localField: 'user_id',
                            //         foreignField: '_id',
                            //         as: 'postUserData'
                            //     }
                            // }
                        ],
                        connectionRemainPosts: [
                            {
                                $match: {
                                    user_id: { $in: finalArr },
                                    createdAt: { $lt: threeDaysAgo },
                                }
                            },
                            {
                                $sort: { createdAt: -1 }
                            },
                            { $addFields: { order: 4 } },
                            // {
                            //     $lookup: {
                            //         from: 'users',
                            //         localField: 'user_id',
                            //         foreignField: '_id',
                            //         as: 'postUserData'
                            //     }
                            // }
                        ],
                        industryRemainPosts: [
                            {
                                $lookup: {
                                    from: 'users',
                                    localField: 'user_id',
                                    foreignField: '_id',
                                    as: 'postUserData',
                                    pipeline: [
                                        {
                                            $match: {
                                                sub_category: { $elemMatch: { $in: req.currentUser.sub_category } }
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                $match: {
                                    'postUserData.0': { $exists: true },
                                    createdAt: { $lt: threeDaysAgo },
                                    user_id: { $nin: finalArr }

                                }
                            },
                            {
                                $sort: { createdAt: -1 }
                            },
                            { $addFields: { order: 5 } },

                        ],
                        appRemainPosts: [
                            {
                                $match: {
                                    createdAt: { $lt: threeDaysAgo },
                                    user_id: { $nin: finalArr }
                                }
                            },
                            {
                                $sort: { createdAt: -1 }
                            },
                            { $addFields: { order: 6 } },
                            // {
                            //     $lookup: {
                            //         from: 'users',
                            //         localField: 'user_id',
                            //         foreignField: '_id',
                            //         as: 'postUserData'
                            //     }
                            // }
                        ]
                    }
                },
                {
                    $project: {
                        allPosts: {
                            $concatArrays: ["$connectionPosts", "$industryPosts", "$appPosts", '$connectionRemainPosts', '$industryRemainPosts', '$appRemainPosts']
                        }
                    }
                },
                {
                    $unwind: "$allPosts"
                },
                {
                    $replaceRoot: { newRoot: "$allPosts" }
                },
                {
                    $lookup: {
                        from: 'blockusers',
                        let: { user_id: '$user_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $and: [{ $eq: ["$to_user_id", '$$user_id'] }, { $eq: ["$from_user_id", req.currentUser._id] }] },
                                            { $and: [{ $eq: ["$from_user_id", '$$user_id'] }, { $eq: ["$to_user_id", req.currentUser._id] }] }
                                        ]
                                    }
                                }
                            },
                            {
                                $project: { _id: 1 }
                            }
                        ],
                        as: 'blockData'
                    }
                },
                {
                    $match: {
                        $or: [
                            { blockData: { $exists: false } },
                            { blockData: { $size: 0 } }
                        ]
                    }
                },
                {
                    $unwind: { path: '$blockData', preserveNullAndEmptyArrays: true }
                },
                {
                    $group: {
                        _id: "$_id",
                        doc: { $first: "$$ROOT" }
                    }
                },
                {
                    $replaceRoot: { newRoot: "$doc" }
                },
                { $sort: { order: 1, createdAt: -1 } },
                {
                    $skip: skip
                },
                {
                    $limit: limit
                },
                // find the reposts
                {
                    $lookup: {
                        from: 'posts',
                        let: { postId: '$repost_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$_id', '$$postId'] }
                                }
                            },
                            {
                                $lookup: {
                                    from: 'users',
                                    localField: 'user_id',
                                    foreignField: '_id',
                                    as: 'rePostUserData',
                                    pipeline: [
                                        {
                                            $lookup: {
                                                from: 'connections',
                                                let: { user_id: '$_id' },
                                                pipeline: [
                                                    {
                                                        $match: {
                                                            $expr: {
                                                                $or: [
                                                                    { $and: [{ $eq: ["$to_user_id", '$$user_id'] }, { $eq: ["$from_user_id", req.currentUser._id] }] },
                                                                    { $and: [{ $eq: ["$from_user_id", '$$user_id'] }, { $eq: ["$to_user_id", req.currentUser._id] }] }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                ],
                                                as: 'connectionData'
                                            }
                                        },
                                        {
                                            $addFields: {
                                                is_connected: {
                                                    $cond: {
                                                        if: { $eq: [{ $size: '$connectionData' }, 0] },
                                                        then: 'default',
                                                        else: {
                                                            $cond: {
                                                                if: {
                                                                    $eq: [
                                                                        { $arrayElemAt: ['$connectionData.from_user_id', 0] },
                                                                        req.currentUser._id
                                                                    ]
                                                                },
                                                                then: { $arrayElemAt: ['$connectionData.from_connection_status', 0] },
                                                                else: { $arrayElemAt: ['$connectionData.to_connection_status', 0] }
                                                            }
                                                        }
                                                    }
                                                },
                                                to_connected: {
                                                    $cond: {
                                                        if: { $eq: [{ $size: '$connectionData' }, 0] },
                                                        then: 'default',
                                                        else: {
                                                            $cond: {
                                                                if: {
                                                                    $eq: [
                                                                        { $arrayElemAt: ['$connectionData.from_user_id', 0] },
                                                                        req.currentUser._id
                                                                    ]
                                                                },
                                                                then: { $arrayElemAt: ['$connectionData.to_connection_status', 0] },
                                                                else: { $arrayElemAt: ['$connectionData.from_connection_status', 0] }
                                                            }
                                                        }
                                                    }
                                                },
                                                is_follow: {
                                                    $cond: {
                                                        if: { $eq: [{ $size: '$connectionData' }, 0] },
                                                        then: false,
                                                        else: {
                                                            $cond: {
                                                                if: {
                                                                    $eq: [
                                                                        { $arrayElemAt: ['$connectionData.from_user_id', 0] },
                                                                        req.currentUser._id
                                                                    ]
                                                                },
                                                                then: { $arrayElemAt: ['$connectionData.from_follow_status', 0] },
                                                                else: { $arrayElemAt: ['$connectionData.to_follow_status', 0] }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        },
                                        {
                                            $project: {
                                                profile_image: 1,
                                                full_name: 1,
                                                category: 1,
                                                is_connected: 1,
                                                to_connected: 1,
                                                is_follow: 1,
                                                createdAt: 1
                                            }
                                        }
                                    ]
                                }
                            },
                            { $unwind: '$rePostUserData' }
                        ],
                        as: 'repostData'
                    }
                },
                // calculate the repost count for this post
                {
                    $lookup: {
                        from: 'posts',
                        let: { postId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$repost_id', '$$postId'] }
                                }
                            },
                        ],
                        as: 'repostCountData'
                    }
                },
                // add a field repostCount
                {
                    $addFields: {
                        repostCount: { $size: '$repostCountData' }
                    }
                },
                { $project: { repostCountData: 0 } },
                {
                    $unwind: {
                        path: '$repostData',
                        preserveNullAndEmptyArrays: true
                    }
                },
                // get post user detail 
                {
                    $lookup: {  //apna post
                        from: 'users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'postUserData',
                        pipeline: [
                            {
                                $lookup: {
                                    from: 'connections',
                                    let: { user_id: '$_id' },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: {
                                                    $or: [
                                                        { $and: [{ $eq: ["$to_user_id", '$$user_id'] }, { $eq: ["$from_user_id", req.currentUser._id] }] },
                                                        { $and: [{ $eq: ["$from_user_id", '$$user_id'] }, { $eq: ["$to_user_id", req.currentUser._id] }] }
                                                    ]
                                                }
                                            }
                                        }
                                    ],
                                    as: 'connectionData'
                                }
                            },
                            // add some fields for checking user it connected with me or not
                            {
                                $addFields: {
                                    is_connected: {
                                        $cond: {
                                            if: { $eq: [{ $size: '$connectionData' }, 0] },
                                            then: 'default',
                                            else: {
                                                $cond: {
                                                    if: {
                                                        $eq: [
                                                            { $arrayElemAt: ['$connectionData.from_user_id', 0] },
                                                            req.currentUser._id
                                                        ]
                                                    },
                                                    then: { $arrayElemAt: ['$connectionData.from_connection_status', 0] },
                                                    else: { $arrayElemAt: ['$connectionData.to_connection_status', 0] }
                                                }
                                            }
                                        }
                                    },
                                    to_connected: {
                                        $cond: {
                                            if: { $eq: [{ $size: '$connectionData' }, 0] },
                                            then: 'default',
                                            else: {
                                                $cond: {
                                                    if: {
                                                        $eq: [
                                                            { $arrayElemAt: ['$connectionData.from_user_id', 0] },
                                                            req.currentUser._id
                                                        ]
                                                    },
                                                    then: { $arrayElemAt: ['$connectionData.to_connection_status', 0] },
                                                    else: { $arrayElemAt: ['$connectionData.from_connection_status', 0] }
                                                }
                                            }
                                        }
                                    },
                                    is_follow: {
                                        $cond: {
                                            if: { $eq: [{ $size: '$connectionData' }, 0] },
                                            then: false,
                                            else: {
                                                $cond: {
                                                    if: {
                                                        $eq: [
                                                            { $arrayElemAt: ['$connectionData.from_user_id', 0] },
                                                            req.currentUser._id
                                                        ]
                                                    },
                                                    then: { $arrayElemAt: ['$connectionData.from_follow_status', 0] },
                                                    else: { $arrayElemAt: ['$connectionData.to_follow_status', 0] }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            {
                                $project: {
                                    profile_image: 1,
                                    full_name: 1,
                                    category: 1,
                                    is_connected: 1,
                                    to_connected: 1,
                                    is_follow: 1,
                                    createdAt: 1
                                }
                            }
                        ],
                    },
                },
                {
                    $unwind: '$postUserData'
                },
                // find the likes for the post
                {
                    $lookup: {
                        from: 'likes',
                        let: { currentUserId: req.currentUser?._id, postId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$user_id', '$$currentUserId'] },
                                            { $eq: ['$post_id', '$$postId'] },
                                            { $in: ['$like_type', ['fist', 'diamond', 'doller']] }
                                        ]
                                    }
                                }
                            },
                            {
                                $project: {
                                    like_type: 1
                                }
                            }
                        ],
                        as: 'likesData'
                    }
                },
                // check this post is saved or not
                {
                    $lookup: {
                        from: 'saveposts',
                        let: { currentUserId: req.currentUser?._id, postId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$user_id', req.currentUser._id] },
                                            { $eq: ['$post_id', '$$postId'] },
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'savePostData'
                    }
                },
                {
                    $addFields: {
                        is_liked: { $cond: { if: { $eq: [{ $size: '$likesData' }, 0] }, then: false, else: true } },
                        reaction_type: { $cond: { if: { $eq: [{ $size: '$likesData' }, 0] }, then: '', else: { $arrayElemAt: ['$likesData.like_type', 0] } } },
                        // isDollerAction: { $cond: { if: { $eq: [{ $size: { $filter: { input: '$likesData', as: 'like', cond: { $eq: ['$$like.like_type', 'doller'] } } } }, 0] }, then: false, else: true } },
                        isSaved: { $cond: { if: { $eq: [{ $size: '$savePostData' }, 0] }, then: false, else: true } },
                    }
                },
                // find the user who is in my connection and also comment on this post
                {
                    $lookup: {
                        from: "comments",
                        let: { postId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$post_id", "$$postId"] }
                                }
                            },
                            {
                                $lookup: {
                                    from: 'connections',
                                    let: { userId: '$user_id' },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: {
                                                    $and: [{
                                                        $or: [
                                                            { $and: [{ $eq: ["$to_user_id", '$$userId'] }, { $eq: ["$from_user_id", req.currentUser._id] }] },
                                                            { $and: [{ $eq: ["$from_user_id", '$$userId'] }, { $eq: ["$to_user_id", req.currentUser._id] }] }
                                                        ]
                                                    }, {
                                                        $or: [{ $and: [{ $eq: ["$to_user_id", req.currentUser._id] }, { $or: [{ $eq: ["$to_follow_status", true] }, { $eq: ["$to_connection_status", true] }] }] },
                                                        { $and: [{ $eq: ["$from_user_id", req.currentUser._id] }, { $or: [{ $eq: ["$from_follow_status", true] }, { $eq: ["$from_connection_status", true] }] }] }
                                                        ]
                                                    }]
                                                }
                                            }
                                        },
                                        {
                                            $lookup: {
                                                from: "users",
                                                let: { user_id: { $cond: [{ $eq: ["$from_user_id", req.currentUser._id] }, "$to_user_id", "$from_user_id"] } },
                                                pipeline: [
                                                    {
                                                        $match: {
                                                            $expr: { $eq: ["$_id", "$$user_id"] }
                                                        }
                                                    },

                                                ],
                                                as: "userData"
                                            }
                                        },
                                        { $unwind: '$userData' },
                                        { '$replaceRoot': { newRoot: '$userData' } }

                                    ],
                                    as: 'commentUserData'
                                }
                            },
                            {
                                $lookup: {
                                    from: 'comment_likes',
                                    let: { currentUserId: req.currentUser?._id, postId: '$post_id', comment_id: '$_id' },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: {
                                                    $and: [
                                                        { $eq: ['$user_id', '$$currentUserId'] },
                                                        { $eq: ['$post_id', '$$postId'] },
                                                        { $eq: ['$comment_id', '$$comment_id'] },
                                                        { $eq: ['$comment_type', 'comment'] }
                                                    ]
                                                }
                                            }
                                        }
                                    ],
                                    as: 'commentsLikeData'
                                }
                            },
                            {
                                $addFields: {
                                    isLiked: { $cond: { if: { $eq: [{ $size: '$commentsLikeData' }, 0] }, then: false, else: true } },
                                }
                            },
                            {
                                $project: {
                                    commentsLikeData: 0
                                }
                            },
                            { $unwind: '$commentUserData' },
                            { $sort: { createdAt: -1 } },
                            { $limit: 1 }
                        ],
                        as: "commentsData"
                    }
                },
                // find the user who is in my connection and also like this post
                {
                    $lookup: {
                        from: "likes",
                        let: { postId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$post_id", "$$postId"] }
                                }
                            },
                            {
                                $lookup: {
                                    from: 'connections',
                                    let: { userId: '$user_id' },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: {
                                                    $and: [{
                                                        $or: [
                                                            { $and: [{ $eq: ["$to_user_id", '$$userId'] }, { $eq: ["$from_user_id", req.currentUser._id] }] },
                                                            { $and: [{ $eq: ["$from_user_id", '$$userId'] }, { $eq: ["$to_user_id", req.currentUser._id] }] }
                                                        ]
                                                    }, {
                                                        $or: [{ $and: [{ $eq: ["$to_user_id", req.currentUser._id] }, { $or: [{ $eq: ["$to_follow_status", true] }, { $eq: ["$to_connection_status", true] }] }] },
                                                        { $and: [{ $eq: ["$from_user_id", req.currentUser._id] }, { $or: [{ $eq: ["$from_follow_status", true] }, { $eq: ["$from_connection_status", true] }] }] }
                                                        ]
                                                    }]
                                                }
                                            }
                                        },
                                        {
                                            $lookup: {
                                                from: "users",
                                                let: { user_id: { $cond: [{ $eq: ["$from_user_id", req.currentUser._id] }, "$to_user_id", "$from_user_id"] } },
                                                pipeline: [
                                                    {
                                                        $match: {
                                                            $expr: { $eq: ["$_id", "$$user_id"] }
                                                        }
                                                    },

                                                ],
                                                as: "userData"
                                            }
                                        },
                                        { $unwind: '$userData' },
                                        { '$replaceRoot': { newRoot: '$userData' } }

                                    ],
                                    as: 'data'
                                }
                            },
                            { $unwind: '$data' },
                            { $sort: { createdAt: -1 } },
                            { $limit: 1 },
                        ],
                        as: "likeDataHeader"
                    }
                },
                {
                    $unwind: { path: '$likesData', preserveNullAndEmptyArrays: true }
                },
                {
                    $project: {
                        likesData: 0,
                        savePostData: 0,
                    }
                }
            ]);

            return helper.successResponseWithExtraData(res, successMessage.ALL_POST, posts, skip);

        } catch (err) {
            console.log(err);
            return helper.catchedErrorResponse(res, errorMessage.INTERNAL_SERVER_ERROR);
        }
    }
];